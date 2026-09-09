import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "../../generated/prisma";

import { env } from "~/env";
import { db } from "~/server/db";
import { evaluarDorsales } from "~/server/dorsales";
import { bytesParaRekognition, runFaceIndex, runOcr } from "~/server/rekognition";
import { deleteS3Objects, headObject } from "~/server/s3";
import { generatePreview } from "~/server/watermark";
import { hasRecognitionQuota } from "~/server/quotas";

/**
 * La cola de trabajo de las fotos.
 *
 * Antes de esto, lo que convierte una foto subida en una foto vendible —marca
 * de agua, miniatura, dorsal, caras— corría adentro del handler de commit, en
 * un `void (async () => …)()` que se lanzaba y no se esperaba. Funcionaba
 * mientras nada lo interrumpiera. La noche del 23 de agosto hubo tres deploys
 * entre las 23:07 y las 23:21; el último lote del 21K se había firmado a las
 * 22:56. Resultado: 160 fotos con tamaño, sin marca de agua, sin OCR y sin
 * caras, en un evento PUBLICADO. El fotógrafo las ve en su panel, la tienda no
 * las muestra —exige previewKey— y el atleta no las encuentra ni por dorsal ni
 * por selfie. Nadie se enteró hasta que las buscamos dos semanas después.
 *
 * La causa no es el bug de una función: es que la promesa de hacer el trabajo
 * vivía SÓLO en la memoria de un proceso que se reinicia en cada deploy. Un
 * `pm2 restart` no es una falla rara, es la operación normal.
 *
 * Así que el trabajo pendiente pasa a estar en la base, que es lo único que
 * sobrevive al reinicio. No hace falta una tabla de trabajos: la fila Photo ya
 * dice exactamente qué le falta —previewKey nulo es "sin marca de agua",
 * faceProcessedAt nulo es "sin caras"— y lo único que había que agregarle es
 * cómo se toma posesión (processLeaseUntil), cuántas veces se intentó
 * (processAttempts) y por qué falló (processError).
 *
 * El commit ya no procesa: confirma el tamaño y toca el timbre. Si el timbre no
 * suena —porque el proceso murió justo ahí— la foto igual está anotada como
 * pendiente y la próxima pasada la levanta. Ésa es toda la diferencia.
 */

/* ── Constantes ─────────────────────────────────────────────────────────── */

const A_LA_VEZ = env.PROCESADOR_A_LA_VEZ;

/** Cuánto dura la posesión de una foto. */
const LEASE_MS = 10 * 60_000;
/**
 * Tope de una unidad de trabajo. ESTRICTAMENTE menor que LEASE_MS.
 *
 * Si una unidad pudiera vivir más que su propio lease, otra pasada podría
 * reclamar la misma foto mientras la primera sigue escribiendo, y las dos
 * borrarían y reescribirían las mismas tres claves de S3.
 */
const TOPE_UNIDAD_MS = 4 * 60_000;

/** Intentos antes de dejarla quieta. */
const MAX_INTENTOS = 4;
/** Cuánto espera una foto que falló por algo transitorio. */
const ESPERA_FALLO_MS = 5 * 60_000;

const TICK_TRABAJO_MS = 2_000;
const TICK_OCIOSO_MS = 20_000;
const TICK_MAX_MS = 10 * 60_000;

/** Cuántas candidatas se piden por consulta. */
const PAGINA = 40;
/** Cada cuánto se miran las filas que quedaron a medias. */
const ADOPCION_CADA_MS = 10 * 60_000;
const LATIDO_MS = 60_000;
/** Una fila recién firmada no está huérfana: la subida puede estar en curso. */
const GRACIA_HUERFANA_MS = 10 * 60_000;
/** Pasado esto, una fila sin archivo confirmado ya no se adopta. */
const ABANDONO_MS = 24 * 60 * 60_000;

/* ── Estado ─────────────────────────────────────────────────────────────── */

type Resumen = {
  pendientesPreview: number;
  pendientesRek: number;
  enVuelo: number;
  enfriandose: number;
  venenosas: number;
  masViejaMin: number | null;
};

type EstadoCola = {
  id: string;
  arrancada: boolean;
  /** En false tras un SIGTERM: se termina lo que está en vuelo y no se toma más. */
  aceptando: boolean;
  /** photoId → cuándo vence su lease. Evita que la misma pasada la elija dos veces. */
  enVuelo: Map<string, number>;
  hayAviso: boolean;
  resolverSueno: (() => void) | null;
  ultimaPasadaAt: number;
  ultimoResumen: Resumen | null;
  /** ownerId → { sinCuota, hasta }. Una consulta por dueño por minuto, no por foto. */
  cuotas: Map<string, { sinCuota: boolean; hasta: number }>;
};

/* En globalThis y no en un `let` de módulo, con el mismo idioma que
   sales-bus.ts y db.ts.

   instrumentation.ts —donde arranca esto— y los route handlers —donde vive
   despertar()— se compilan en capas distintas de webpack, así que este módulo
   se evalúa DOS veces. Con estado de módulo, el commit resolvería la promesa
   de un dormidero que nadie está esperando, y el bucle se despertaría recién
   en el tick ocioso: veinte segundos de retraso en cada foto, y dos bucles
   compitiendo por las mismas filas. */
declare global {
  // eslint-disable-next-line no-var
  var __cuervito_cola__: EstadoCola | undefined;
}

const estado: EstadoCola = (globalThis.__cuervito_cola__ ??= {
  id: randomUUID().slice(0, 8),
  arrancada: false,
  aceptando: true,
  enVuelo: new Map(),
  hayAviso: false,
  resolverSueno: null,
  ultimaPasadaAt: 0,
  ultimoResumen: null,
  cuotas: new Map(),
});

/* ── Los predicados, definidos una sola vez ─────────────────────────────── */

/**
 * Fotos que llegaron y todavía no tienen marca de agua.
 *
 * Sin ventana de tiempo a propósito: una foto sin preview es invisible en la
 * tienda y ya está cobrada al fotógrafo en storage, así que repararla siempre
 * conviene y no le cuesta un centavo a Rekognition.
 */
export function dondePendientePreview(ahora = new Date()): Prisma.PhotoWhereInput {
  return {
    fileSize: { not: null },
    deletedAt: null,
    previewKey: null,
    processAttempts: { lt: MAX_INTENTOS },
    OR: [{ processLeaseUntil: null }, { processLeaseUntil: { lt: ahora } }],
  };
}

/**
 * Fotos que ya se ven pero a las que les falta el reconocimiento.
 *
 * Acá SÍ hay que tener cuidado, porque cada una es una llamada paga. Medido
 * antes de escribir esto: hoy no hay ninguna. Las columnas ocrProcessedAt y
 * faceProcessedAt se ponen AL RECLAMAR —es el protocolo que comparten runOcr,
 * runFaceIndex y la Lambda para no pagar dos veces— así que sólo vuelven a
 * nulo cuando un error transitorio las libera. Es decir: esta consulta trae
 * exactamente lo que falló y se puede reintentar, y nunca el histórico.
 */
export function dondePendienteRek(
  ahora = new Date(),
  sinCuota: string[] = [],
): Prisma.PhotoWhereInput {
  return {
    fileSize: { not: null },
    deletedAt: null,
    previewKey: { not: null },
    processAttempts: { lt: MAX_INTENTOS },
    OR: [{ processLeaseUntil: null }, { processLeaseUntil: { lt: ahora } }],
    ...(sinCuota.length ? { ownerId: { notIn: sinCuota } } : {}),
    event: { recognition: true },
    AND: [
      {
        OR: [
          { faceProcessedAt: null },
          { AND: [{ event: { bibDetection: true } }, { ocrProcessedAt: null }] },
        ],
      },
    ],
  };
}

/* ── Posesión ───────────────────────────────────────────────────────────── */

/**
 * Tomar posesión de una foto. Devuelve false si otro llegó primero.
 *
 * Un solo UPDATE condicional: es atómico por sentencia, así que dos procesos
 * que lo intenten a la vez producen exactamente un ganador sin necesitar una
 * transacción. Es el mismo idioma que ya usan runOcr, runFaceIndex y la
 * Lambda, y funciona bajo pgbouncer en modo transacción, que es como nos
 * conectamos.
 *
 * processAttempts se incrementa ACÁ y no al fallar. Si se incrementara al
 * fallar, una foto que mata al proceso —sharp con una imagen enorme— nunca
 * llegaría a sumar el intento, y al reiniciar la volvería a tomar, y a matarlo,
 * para siempre. Contando al reclamar, cada muerte cuesta un intento y a la
 * cuarta la foto queda quieta.
 */
async function reclamar(id: string, hasta: Date): Promise<boolean> {
  const ahora = new Date();
  const r = await db.photo.updateMany({
    where: {
      id,
      OR: [{ processLeaseUntil: null }, { processLeaseUntil: { lt: ahora } }],
    },
    data: {
      processLeaseUntil: hasta,
      processAttempts: { increment: 1 },
      processError: null,
    },
  });
  return r.count === 1;
}

type Salida =
  | { tipo: "ok" }
  | { tipo: "transitorio"; motivo: string }
  | { tipo: "permanente"; motivo: string }
  | { tipo: "sin_cuota"; motivo: string };

/** El primer instante del mes que viene, en UTC. */
function meseQueViene(): Date {
  const a = new Date();
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1));
}

/**
 * Soltar la foto, con el resultado.
 *
 * SIEMPRE con `processLeaseUntil: hasta` en el where. Eso es el fencing: si
 * esta unidad se pasó de su lease y otra pasada ya reclamó la foto, el where no
 * matchea y esta escritura no hace nada. Sin él, una unidad lenta le sacaría el
 * lease de las manos a la que está trabajando de verdad.
 */
async function soltar(id: string, hasta: Date, r: Salida): Promise<void> {
  const data =
    r.tipo === "ok"
      ? { processLeaseUntil: null, processAttempts: 0, processError: null }
      : r.tipo === "permanente"
        ? {
            // Se deja en el tope: no se vuelve a mirar, pero queda visible para
            // el panel y se puede desbloquear a mano.
            processLeaseUntil: null,
            processAttempts: MAX_INTENTOS,
            processError: r.motivo.slice(0, 200),
          }
        : r.tipo === "sin_cuota"
          ? {
              // Quedarse sin cuota no es culpa de la foto: se le devuelve el
              // intento y se la deja dormida hasta el mes que viene.
              processLeaseUntil: meseQueViene(),
              processAttempts: { decrement: 1 },
              processError: r.motivo.slice(0, 200),
            }
          : {
              // El lease en el futuro ES el backoff: mientras esté vigente, el
              // predicado no la trae.
              processLeaseUntil: new Date(Date.now() + ESPERA_FALLO_MS),
              processError: r.motivo.slice(0, 200),
            };

  await db.photo
    .updateMany({ where: { id, processLeaseUntil: hasta }, data })
    .catch((e: unknown) => console.error("[cola] soltar falló", id, e));
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

/**
 * Devolver a la cola lo que quedó tomado por un proceso que ya no existe.
 *
 * Con pm2 en fork y UNA instancia, todo lease vigente en el instante del
 * arranque es de un proceso muerto: nadie más pudo haberlo tomado. Sin esto,
 * las fotos que estaban en vuelo cuando se hizo el deploy esperan a que venza
 * el lease —diez minutos— antes de que alguien las vuelva a mirar.
 *
 * El decrement devuelve el intento: lo consumió un deploy, no la foto. Sin él,
 * cuatro deploys en medio de una tanda dejarían fotos marcadas como venenosas
 * sin que nada esté roto.
 *
 * En cluster esto NO se puede hacer —el lease vivo puede ser de otra instancia
 * que está trabajando ahora mismo—, por eso PROCESADOR_UNICA_INSTANCIA.
 */
async function liberarLeasesHuerfanos(): Promise<void> {
  if (!env.PROCESADOR_UNICA_INSTANCIA) return;
  const r = await db.photo.updateMany({
    where: { processLeaseUntil: { gt: new Date() }, processError: null },
    data: { processLeaseUntil: null, processAttempts: { decrement: 1 } },
  });
  if (r.count > 0) console.log(`[cola] leases huérfanos liberados=${r.count}`);
}

/**
 * Arranca el consumidor. Idempotente: llamarla dos veces no hace nada.
 */
export function arrancarCola(): void {
  if (estado.arrancada) return;
  if (!env.PROCESADOR_ACTIVO) {
    console.log("[cola] apagada (PROCESADOR_ACTIVO=false)");
    return;
  }
  estado.arrancada = true;
  console.log(`[cola] arranca id=${estado.id} aLaVez=${A_LA_VEZ}`);

  /* SIGTERM no mata nada: deja de tomar trabajo nuevo.

     No se llama a process.exit ni se toca el handler de Next. Lo único que
     cambia es que la próxima pasada no reclama: lo que está en vuelo termina y
     suelta su lease como corresponde. Si pm2 mata antes, esas fotos quedan con
     el lease vigente y las libera el arranque siguiente. */
  const cerrar = () => {
    estado.aceptando = false;
    console.log("[cola] no se toma más trabajo (señal de cierre)");
  };
  process.once("SIGTERM", cerrar);
  process.once("SIGINT", cerrar);

  void (async () => {
    try {
      await liberarLeasesHuerfanos();
    } catch (e) {
      console.error("[cola] no se pudieron liberar los leases:", e);
    }
    void bucle();
    void ciclarHuerfanas();
  })();
}

/* ── Despertar ──────────────────────────────────────────────────────────── */

/**
 * Hay trabajo nuevo. Lo llama el commit.
 *
 * No es el mecanismo: es el atajo. Si este aviso se pierde —porque el proceso
 * murió entre el commit y el timbre— la foto igual quedó anotada como pendiente
 * en la base y la levanta la próxima pasada. Sin el aviso, la diferencia es
 * esperar hasta veinte segundos; sin la base, la diferencia es no procesarla
 * nunca.
 */
export function despertar(): void {
  estado.hayAviso = true;
  const r = estado.resolverSueno;
  estado.resolverSueno = null;
  r?.();
}

function dormir(ms: number): Promise<void> {
  // El aviso se consume ANTES de crear la promesa: si llegó entre el findMany
  // vacío y este punto, no se pierde.
  if (estado.hayAviso) {
    estado.hayAviso = false;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    estado.resolverSueno = resolve;
    const t = setTimeout(() => {
      estado.resolverSueno = null;
      resolve();
    }, ms);
    // Sin unref, este timer solo mantiene vivo el proceso.
    t.unref?.();
  });
}

/* ── Cuotas ─────────────────────────────────────────────────────────────── */

/**
 * Qué dueños están sin cuota, con caché de un minuto.
 *
 * Se pregunta una vez por dueño por pasada y no una vez por foto: un dueño en
 * el tope con mil fotos pendientes serían mil consultas por vuelta contra un
 * pool de diez conexiones.
 */
async function duenosSinCuota(ownerIds: string[]): Promise<string[]> {
  const ahora = Date.now();
  const sin: string[] = [];
  for (const id of new Set(ownerIds)) {
    const c = estado.cuotas.get(id);
    if (c && c.hasta > ahora) {
      if (c.sinCuota) sin.push(id);
      continue;
    }
    const tiene = await hasRecognitionQuota(id, 1).catch(() => true);
    estado.cuotas.set(id, { sinCuota: !tiene, hasta: ahora + 60_000 });
    if (!tiene) sin.push(id);
  }
  return sin;
}

/* ── Elegir ─────────────────────────────────────────────────────────────── */

let pasadas = 0;

/**
 * Qué fotos tocan ahora. Primero las invisibles, después las que no se buscan.
 *
 * Por etapa y no una sola cola por fecha: una foto sin marca de agua no se
 * puede ni ver ni vender, y una a la que le falta el reconocimiento se ve y se
 * vende igual. Si fuera una sola cola, un backlog de reconocimiento dejaría
 * esperando a fotos que están invisibles en una tienda publicada.
 *
 * Cada quinta pasada mira al revés (las más viejas primero). Es envejecimiento:
 * con orden fijo por fecha descendente y subidas continuas, lo viejo que falló
 * una vez no vuelve a mirarse nunca.
 */
async function elegir(n: number): Promise<string[]> {
  const ahora = new Date();
  const enVuelo = [...estado.enVuelo.keys()];
  const orden = ++pasadas % 5 === 0 ? "asc" : "desc";

  const previews = await db.photo.findMany({
    where: { ...dondePendientePreview(ahora), id: { notIn: enVuelo } },
    select: { id: true },
    take: Math.min(n, PAGINA),
    orderBy: { createdAt: orden },
  });
  if (previews.length >= n) return previews.map((p) => p.id);

  // Sólo si sobran lugares. Y con los dueños sin cuota afuera, para no traer
  // filas que se van a descartar una por una.
  const candidatos = await db.photo.findMany({
    where: { ...dondePendienteRek(ahora), id: { notIn: enVuelo } },
    select: { id: true, ownerId: true },
    take: PAGINA,
    orderBy: { createdAt: orden },
  });
  const sinCuota = new Set(await duenosSinCuota(candidatos.map((c) => c.ownerId)));
  const reks = candidatos
    .filter((c) => !sinCuota.has(c.ownerId))
    .slice(0, n - previews.length)
    .map((c) => c.id);

  return [...previews.map((p) => p.id), ...reks];
}

/* ── Procesar una ───────────────────────────────────────────────────────── */

async function procesarUna(id: string): Promise<Salida> {
  const foto = await db.photo.findUnique({
    where: { id },
    select: {
      id: true,
      eventId: true,
      storageKey: true,
      previewKey: true,
      previewCleanKey: true,
      fileSize: true,
      deletedAt: true,
      ocrProcessedAt: true,
      faceProcessedAt: true,
      event: { select: { recognition: true, bibDetection: true } },
    },
  });
  // Nada que hacer no es un fallo: la foto se borró o nunca llegó.
  if (!foto || foto.deletedAt || foto.fileSize === null) return { tipo: "ok" };

  if (!foto.previewKey) {
    const r = await generatePreview(foto.id);
    if (!r.watermarkedKey) {
      const m = r.error?.mensaje ?? "no se pudo generar el preview";
      return r.error?.permanente
        ? { tipo: "permanente", motivo: `corrupta: ${m}` }
        : { tipo: "transitorio", motivo: `s3: ${m}` };
    }
    /* Sin seguir a reconocimiento en la misma vuelta si el preview falló.

       En el commit de antes seguir era gratis, porque era un intento único.
       Acá es un bucle: insistir con Rekognition sobre una foto que ni siquiera
       se pudo abrir es pagar por algo que va a fallar igual. La próxima pasada
       la toma con el preview ya hecho. */
    despertar();
    return { tipo: "ok" };
  }

  if (!foto.event.recognition) return { tipo: "ok" };

  const faltaCaras = foto.faceProcessedAt === null;
  const faltaOcr = foto.event.bibDetection && foto.ocrProcessedAt === null;
  if (!faltaCaras && !faltaOcr) return { tipo: "ok" };

  // Una sola preparación de bytes para las dos etapas: bajar el preview limpio
  // y reencodearlo cuesta, y hacerlo dos veces no aporta nada.
  const bytes = await bytesParaRekognition(foto);
  if (!bytes) return { tipo: "transitorio", motivo: "s3: no se pudieron leer los bytes" };

  const estados: string[] = [];
  if (faltaOcr) {
    const r = await runOcr(foto.id, bytes);
    estados.push(r.estado);
    // evaluarDorsales sólo cuando de verdad hubo lectura: es lo que decide
    // apagar el OCR del evento, y decidir con una muestra de fallos apagaría
    // la búsqueda por dorsal de un evento que sí los tiene.
    if (r.estado === "hecha") {
      await evaluarDorsales(foto.eventId).catch((e: unknown) =>
        console.error("[cola] evaluarDorsales:", e),
      );
    }
  }
  if (faltaCaras) {
    const r = await runFaceIndex(foto.id, foto.eventId, bytes);
    estados.push(r.estado);
  }

  // Sin cuota manda sobre todo lo demás: no es un fallo de la foto.
  if (estados.includes("sin_cuota")) {
    return { tipo: "sin_cuota", motivo: "cuota: tope mensual de reconocimiento" };
  }
  if (estados.includes("error")) {
    return { tipo: "transitorio", motivo: "rek: falló una llamada" };
  }
  // Un 'permanente' de Rekognition NO bloquea la foto: la columna quedó puesta
  // y esa etapa no se vuelve a intentar, pero la foto ya se ve y se vende.
  return { tipo: "ok" };
}

/**
 * Con tope de tiempo, y el tope es menor que el lease.
 *
 * Los timeouts de S3 y Rekognition hacen que ninguna etapa se cuelgue sola,
 * pero esto es el cinturón: lo que sea que tarde más de cuatro minutos no va a
 * terminar bien, y dejarlo correr retiene un permiso del semáforo de sharp.
 */
async function procesarConTope(id: string): Promise<Salida> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<Salida>((resolve) => {
    reloj = setTimeout(
      () => resolve({ tipo: "transitorio", motivo: "tope: pasó el tiempo máximo" }),
      TOPE_UNIDAD_MS,
    );
    reloj.unref?.();
  });
  try {
    // La perdedora no se cancela —no hay cómo— pero su rechazo no puede quedar
    // suelto: un unhandledRejection en Next tumba el proceso entero.
    return await Promise.race([
      procesarUna(id).catch((e: unknown) => ({
        tipo: "transitorio" as const,
        motivo: `error: ${e instanceof Error ? e.message : String(e)}`,
      })),
      tope,
    ]);
  } finally {
    clearTimeout(reloj);
  }
}

/* ── El bucle ───────────────────────────────────────────────────────────── */

async function unaPasada(): Promise<number> {
  if (!estado.aceptando) return 0;

  const lugares = A_LA_VEZ - estado.enVuelo.size;
  if (lugares <= 0) return 0;

  const ids = await elegir(lugares);
  if (ids.length === 0) return 0;

  await Promise.all(
    ids.map(async (id) => {
      const hasta = new Date(Date.now() + LEASE_MS);
      if (!(await reclamar(id, hasta))) return;
      estado.enVuelo.set(id, hasta.getTime());
      try {
        const r = await procesarConTope(id);
        if (r.tipo !== "ok") {
          console.warn(`[cola] photo=${id} ${r.tipo}: ${r.motivo}`);
        }
        await soltar(id, hasta, r);
      } catch (e) {
        // Una foto no puede voltear la pasada.
        console.error(`[cola] photo=${id} explotó:`, e);
        await soltar(id, hasta, {
          tipo: "transitorio",
          motivo: `error: ${e instanceof Error ? e.message : String(e)}`,
        }).catch(() => undefined);
      } finally {
        estado.enVuelo.delete(id);
      }
    }),
  );

  estado.ultimaPasadaAt = Date.now();
  return ids.length;
}

async function bucle(): Promise<void> {
  let espera = TICK_OCIOSO_MS;
  let ultimoLatido = 0;

  while (true) {
    let hechas = 0;
    try {
      hechas = await unaPasada();
      espera = hechas > 0 ? TICK_TRABAJO_MS : Math.min(espera * 2, TICK_MAX_MS);
    } catch (e) {
      /* El try va POR VUELTA y no afuera del while.

         Si envolviera al while, un error de conexión —que en este VPS pasa—
         terminaría el bucle y el procesamiento se detendría en silencio hasta
         el próximo deploy. Acá una vuelta que falla espera un poco más y sigue. */
      console.error("[cola] tick falló:", e);
      espera = Math.min(Math.max(espera, 1_000) * 2, TICK_MAX_MS);
    }

    if (Date.now() - ultimoLatido > LATIDO_MS) {
      ultimoLatido = Date.now();
      await latir().catch(() => undefined);
    }

    if (hechas === 0) await dormir(espera);
  }
}

/**
 * Una línea por minuto, pero sólo si hay algo que decir.
 *
 * El silencio y la salud tienen que poder distinguirse: un log que no dice nada
 * cuando todo anda bien es idéntico a un log que no dice nada porque el bucle
 * murió. Por eso el latido sale sólo cuando hay pendientes o cosas en vuelo, y
 * el resumen queda guardado para que el endpoint lo pueda leer.
 */
async function latir(): Promise<void> {
  const r = await resumen();
  estado.ultimoResumen = r;
  if (r.pendientesPreview + r.pendientesRek + r.enVuelo + r.enfriandose === 0) return;
  console.log(
    `[cola] latido id=${estado.id} pendientesPreview=${r.pendientesPreview} ` +
      `pendientesRek=${r.pendientesRek} enVuelo=${r.enVuelo} ` +
      `enfriandose=${r.enfriandose} venenosas=${r.venenosas} masViejaMin=${r.masViejaMin ?? "-"}`,
  );
}

async function resumen(): Promise<Resumen> {
  const ahora = new Date();
  const [pendientesPreview, pendientesRek, enfriandose, venenosas, masVieja] =
    await Promise.all([
      db.photo.count({ where: dondePendientePreview(ahora) }),
      db.photo.count({ where: dondePendienteRek(ahora) }),
      db.photo.count({
        where: { processLeaseUntil: { gt: ahora }, processError: { not: null } },
      }),
      db.photo.count({
        where: { processAttempts: { gte: MAX_INTENTOS }, previewKey: null, deletedAt: null },
      }),
      db.photo.findFirst({
        where: dondePendientePreview(ahora),
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

  return {
    pendientesPreview,
    pendientesRek,
    enVuelo: estado.enVuelo.size,
    enfriandose,
    venenosas,
    masViejaMin: masVieja
      ? Math.round((ahora.getTime() - masVieja.createdAt.getTime()) / 60_000)
      : null,
  };
}

/* ── Filas a medias ─────────────────────────────────────────────────────── */

/**
 * Qué hacer con las filas que se firmaron y nunca se confirmaron.
 *
 * Hay 1.658 acumuladas: cada una es una subida que murió a mitad de camino
 * —hasta ahora, casi siempre porque la URL firmada había vencido—. Una fila sin
 * fileSize es invisible en todos lados y ocupa lugar, y su objeto en S3, si
 * llegó a subirse, es storage que se paga y no se cobra.
 *
 * Tres casos y no dos:
 *
 *   · reciente y el objeto está  → llegó pero el commit no corrió: se adopta.
 *   · vieja y el objeto está     → NO se adopta. Ya la re-subieron: el botón de
 *                                  reintentar crea fila y objeto nuevos, así
 *                                  que adoptarla ahora publicaría la misma foto
 *                                  dos veces en un evento con ventas.
 *   · el objeto no está          → la subida nunca llegó: se borra la fila.
 *
 * Y un cuarto que no es un caso: si S3 contesta con un error que no es 404, no
 * se decide nada. Ésa es la razón de headObject: con el catch pelado de antes,
 * un mal momento de S3 se leía como "no existe" y borraba filas buenas.
 */
export async function barrerHuerfanas(): Promise<{
  adoptadas: number;
  borradas: number;
  objetosBorrados: number;
  sinDecidir: number;
}> {
  const ahora = Date.now();
  const filas = await db.photo.findMany({
    where: {
      fileSize: null,
      deletedAt: null,
      createdAt: { lt: new Date(ahora - GRACIA_HUERFANA_MS) },
    },
    select: { id: true, storageKey: true, createdAt: true },
    take: 200,
    orderBy: { createdAt: "asc" },
  });

  let adoptadas = 0;
  let borradas = 0;
  let objetosBorrados = 0;
  let sinDecidir = 0;

  for (let i = 0; i < filas.length; i += 8) {
    await Promise.all(
      filas.slice(i, i + 8).map(async (f) => {
        const h = await headObject(f.storageKey);
        if (h.estado === "error") {
          sinDecidir++;
          return;
        }
        const vieja = ahora - f.createdAt.getTime() > ABANDONO_MS;

        if (h.estado === "existe" && !vieja) {
          const r = await db.photo.updateMany({
            where: { id: f.id, fileSize: null },
            data: { fileSize: h.size },
          });
          if (r.count === 1) adoptadas++;
          return;
        }

        if (h.estado === "existe" && vieja) {
          await deleteS3Objects([f.storageKey]).catch(() => undefined);
          objetosBorrados++;
        }
        await db.photo.delete({ where: { id: f.id } }).catch(() => undefined);
        borradas++;
      }),
    );
  }

  if (adoptadas > 0) despertar();
  if (adoptadas + borradas + sinDecidir > 0) {
    console.log(
      `[cola] huérfanas adoptadas=${adoptadas} borradas=${borradas} ` +
        `objetosBorrados=${objetosBorrados} sinDecidir=${sinDecidir}`,
    );
  }
  return { adoptadas, borradas, objetosBorrados, sinDecidir };
}

async function ciclarHuerfanas(): Promise<void> {
  while (true) {
    await new Promise((r) => {
      const t = setTimeout(r, ADOPCION_CADA_MS);
      t.unref?.();
    });
    if (!estado.aceptando) continue;
    await barrerHuerfanas().catch((e: unknown) =>
      console.error("[cola] barrer huérfanas falló:", e),
    );
  }
}

/* ── Para el endpoint y el panel ────────────────────────────────────────── */

export async function estadoCola() {
  return {
    id: estado.id,
    arrancada: estado.arrancada,
    aceptando: estado.aceptando,
    ultimaPasadaHaceS: estado.ultimaPasadaAt
      ? Math.round((Date.now() - estado.ultimaPasadaAt) / 1000)
      : null,
    resumen: await resumen(),
  };
}

/**
 * Devolver a la cola fotos que se dieron por perdidas.
 *
 * Por clase de error, que es el prefijo de processError. Por defecto 'cuota',
 * que es el caso legítimo: el mes cambió y ahora sí se pueden procesar. Las
 * 'corrupta:' se pueden reintentar a mano si se arregló algo, pero no por
 * defecto: son las que van a fallar igual.
 */
export async function reintentarVenenosas(opts: {
  eventId?: string;
  clase?: string;
}): Promise<number> {
  const clase = opts.clase ?? "cuota";
  const r = await db.photo.updateMany({
    where: {
      ...(opts.eventId ? { eventId: opts.eventId } : {}),
      deletedAt: null,
      processError: { startsWith: clase },
    },
    data: { processAttempts: 0, processLeaseUntil: null, processError: null },
  });
  if (r.count > 0) despertar();
  return r.count;
}

/**
 * Volver a pedir el reconocimiento de un evento entero.
 *
 * Es el opt-in para el backlog viejo: las fotos que quedaron sin caras por el
 * tope de gasto de mayo no las toca nadie sola, porque cada una es una llamada
 * paga y son miles. Acá se decide evento por evento, a mano.
 */
export async function reconocerEvento(eventId: string): Promise<number> {
  const r = await db.photo.updateMany({
    where: {
      eventId,
      deletedAt: null,
      fileSize: { not: null },
      previewKey: { not: null },
      faceProcessedAt: null,
    },
    data: { processAttempts: 0, processLeaseUntil: null, processError: null },
  });
  if (r.count > 0) despertar();
  return r.count;
}
