import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "../../generated/prisma";

import { env } from "~/env";
import { db } from "~/server/db";
import { ultimosTiempos } from "~/server/diagnostico";
import { evaluarDorsales } from "~/server/dorsales";
import { bytesParaRekognition, runFaceIndex, runOcr, type EstadoRek } from "~/server/rekognition";
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
const LEASE_MS = 25 * 60_000;
/**
 * Tope de una unidad de trabajo. ESTRICTAMENTE menor que LEASE_MS.
 *
 * Si una unidad pudiera vivir más que su propio lease, otra pasada podría
 * reclamar la misma foto mientras la primera sigue escribiendo, y las dos
 * borrarían y reescribirían las mismas tres claves de S3.
 */
/* Subido de 4 a 12 minutos el 20/9.

   Con el tope en cuatro, dos álbumes enteros no avanzaban NADA: cada foto
   pasaba el tope, se soltaba con error, y la siguiente pasada volvía a
   empezar de cero. Cero fotos por hora es peor que lentas. Doce deja
   terminar a la que tarda de más, y el diagnóstico de abajo dice por qué
   tarda. */
const TOPE_UNIDAD_MS = 12 * 60_000;

/**
 * Cuántas veces se intenta una foto, y cuánto se espera entre una y otra.
 *
 * Cuatro seguidas, a cinco minutos, como siempre: un deploy o un timeout
 * suelto de S3 se arreglan ahí. Después la cola no se rinde: sigue, cada vez
 * más espaciado, durante una semana, y recién ahí la deja quieta.
 *
 * Antes se rendía a la cuarta, y quieta quería decir para siempre, hasta que
 * alguien la destrabara a mano. Del 16 al 20 de septiembre la ruta del VPS a
 * S3 anduvo a pocos KB/s: todas las fotos de esos días se pasaron del tope
 * cuatro veces en quince minutos y quedaron quietas, algunas sin marca de agua
 * y muchas más sin reconocimiento —se veían, pero nadie las encontraba por
 * selfie ni por dorsal—. La falla duró cuatro días; los reintentos, un cuarto
 * de hora. Una semana cubre una falla así con margen: lo que se rompe por días
 * se recupera solo cuando vuelve.
 *
 * Reintentar no es gratis en la etapa de reconocimiento, y por eso hay techo:
 * una foto que falla siempre hace quince intentos en total, no infinitos. Lo
 * que cuesta cada uno depende de dónde falla —el tope casi siempre corta antes
 * de llamar a Rekognition—. Cuando lo que falla es Rekognition mismo, para
 * todas las fotos a la vez, no es la foto la que tiene que esperar: eso lo
 * frena el freno de más abajo, antes de que los reintentos se coman la cuota
 * del mes del fotógrafo.
 *
 * El MCP de operaciones copia INTENTOS_RAPIDOS, MAX_INTENTOS y las horas para
 * distinguir "se está reintentando" de "se rindió"; un test de mcp/ falla si
 * cambian acá y no allá. Y el panel del fotógrafo usa dondeApartadaPreview():
 * nada fuera de este archivo tiene que saber el número.
 */
const INTENTOS_RAPIDOS = 4;
/** Cuánto espera una foto que falló por algo transitorio, en la etapa rápida. */
const ESPERA_FALLO_MS = 5 * 60_000;
/** Las esperas de la etapa lenta, en horas. Suman 175: poco más de siete días. */
const ESPERAS_LENTAS_H = [1, 2, 4, 8, 16, 24, 24, 24, 24, 24, 24];
/** Intentos antes de dejarla quieta: 4 rápidos + 11 lentos. */
const MAX_INTENTOS = INTENTOS_RAPIDOS + ESPERAS_LENTAS_H.length;

/** Cuánto esperar después de que falle el intento número `intentos`. */
function esperaTrasFallo(intentos: number): number {
  if (intentos < INTENTOS_RAPIDOS) return ESPERA_FALLO_MS;
  const i = Math.min(intentos - INTENTOS_RAPIDOS, ESPERAS_LENTAS_H.length - 1);
  return ESPERAS_LENTAS_H[i]! * 3_600_000;
}

/**
 * El freno del reconocimiento: cuando lo que falla es Rekognition, no la foto.
 *
 * Los reintentos son por foto, y eso está bien para una foto rara. Pero si se
 * vencen las credenciales, falta un permiso o AWS tiene un problema, fallan
 * TODAS, y cada intento cuenta en la cuota mensual del fotógrafo antes de
 * hacerse (billedCall). Con quince intentos por foto, un evento grande se come
 * la cuota del mes sin reconocer ni una foto, y con la cuota agotada se le
 * apaga la búsqueda por selfie hasta fin de mes.
 *
 * Así que después de FRENO_FALLOS fallos seguidos de Rekognition, sin ningún
 * éxito en el medio, la cola deja de tomar reconocimientos durante
 * FRENO_PAUSA_MS y sigue sólo con las vistas previas, que no cuestan. Al volver
 * prueba con una: si falla, frena de nuevo. Las fotos esperan sin gastar
 * intentos, y el freno queda anotado en Setting para que el MCP de operaciones
 * lo informe aunque siga habiendo subidas.
 */
const FRENO_FALLOS = 10;
const FRENO_PAUSA_MS = 30 * 60_000;
const CLAVE_FRENO = "procesador:freno-reconocimiento";

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
  /** Fallaron las cuatro rápidas y esperan un reintento lento (horas). */
  reintentandoDespacio: number;
  /** Se rindió la cola: sin marca de agua, invisibles en la tienda. */
  venenosas: number;
  /** Se rindió la cola: se ven, pero no se encuentran por selfie ni dorsal. */
  venenosasRek: number;
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
  /** Fallos seguidos de Rekognition, sin un éxito en el medio. */
  rekFallosSeguidos: number;
  /** Hasta cuándo no se toman reconocimientos (epoch ms; 0 si no hay freno). */
  rekPausaHasta: number;
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
  rekFallosSeguidos: 0,
  rekPausaHasta: 0,
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

/**
 * Fotos sin marca de agua que la cola ya no va a tomar.
 *
 * Es lo que el panel del fotógrafo le muestra como "no se pudieron procesar",
 * con el consejo de volver a subirlas. Vive acá porque depende de
 * MAX_INTENTOS: con el número escrito en el panel, una foto que todavía está
 * en los reintentos lentos aparecía como perdida, el fotógrafo la volvía a
 * subir, el reintento salía bien, y la misma foto quedaba dos veces en la
 * tienda.
 */
export function dondeApartadaPreview(): Prisma.PhotoWhereInput {
  return {
    deletedAt: null,
    fileSize: { not: null },
    previewKey: null,
    processAttempts: { gte: MAX_INTENTOS },
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
 * para siempre. Contando al reclamar, cada muerte cuesta un intento y al
 * llegar a MAX_INTENTOS la foto queda quieta.
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
  /** aviso: algo que no se reintenta pero hay que poder ver (ver procesarUna). */
  | { tipo: "ok"; aviso?: string }
  | { tipo: "transitorio"; motivo: string }
  | { tipo: "permanente"; motivo: string }
  | { tipo: "sin_cuota"; motivo: string };

/** El primer instante del mes siguiente al de `desde`, en UTC. */
function meseQueViene(desde = new Date()): Date {
  return new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 1));
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
  try {
    const data =
      r.tipo === "ok"
        ? // El aviso es para quien mira, no para la cola: los predicados no
          // leen processError, así que una foto soltada con aviso queda tan
          // terminada como una sin él.
          { processLeaseUntil: null, processAttempts: 0, processError: r.aviso ?? null }
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
            : { processLeaseUntil: esperaDe(await intentosDe(id)), processError: r.motivo.slice(0, 200) };

    await db.photo.updateMany({ where: { id, processLeaseUntil: hasta }, data });
  } catch (e) {
    console.error("[cola] soltar falló", id, e);
  }
}

/**
 * El lease de una foto que falló por algo transitorio. El lease en el futuro
 * ES el backoff: mientras esté vigente, el predicado no la trae.
 *
 * En el último intento, null: la foto queda quieta igual —el predicado corta
 * por processAttempts—, y así "quieta" se lee igual en todos lados, con o sin
 * este fallo, sin un lease de un día que la haga parecer en espera.
 */
function esperaDe(intentos: number): Date | null {
  if (intentos >= MAX_INTENTOS) return null;
  return new Date(Date.now() + esperaTrasFallo(intentos));
}

/**
 * Cuántas veces se reclamó. Una lectura más, sólo cuando algo falla. Mientras
 * esta unidad tenga el lease nadie más cambia el contador, así que el valor es
 * el que dejó su propio reclamo. Si la lectura falla, la espera corta: mejor
 * reintentar pronto que no soltar.
 */
async function intentosDe(id: string): Promise<number> {
  const f = await db.photo
    .findUnique({ where: { id }, select: { processAttempts: true } })
    .catch(() => null);
  return f?.processAttempts ?? 0;
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

/**
 * Devolver a la cola lo que quedó tomado por un proceso que ya no existe.
 *
 * Con pm2 en fork y UNA instancia, todo lease vigente en el instante del
 * arranque es de un proceso muerto: nadie más pudo haberlo tomado. Sin esto,
 * las fotos que estaban en vuelo cuando se hizo el deploy esperan a que venza
 * el lease —veinticinco minutos— antes de que alguien las vuelva a mirar.
 *
 * Y pasa en casi todos los deploys, no sólo cuando pm2 se cansa de esperar:
 * Next atiende el SIGTERM cerrando el servidor HTTP y, apenas terminan los
 * pedidos, llama a process.exit sin esperar a la cola. Lo que estaba a medias
 * se corta.
 *
 * El intento NO se devuelve. Antes se devolvía —"lo consumió un deploy, no la
 * foto"—, y eso tenía un agujero: una foto que voltea al proceso también deja
 * su lease sin soltar, así que al arrancar se le devolvía el intento, se la
 * volvía a tomar, y volvía a voltearlo, para siempre, con el sitio entero
 * cayéndose en cada vuelta. Con quince intentos, unos cuantos deploys en medio
 * de una tanda sobran; y una foto que mata al proceso ahora sigue el mismo
 * camino que una que falla: los rápidos seguidos, después las esperas largas,
 * y quieta al final.
 *
 * En cluster esto NO se puede hacer —el lease vivo puede ser de otra instancia
 * que está trabajando ahora mismo—, por eso PROCESADOR_UNICA_INSTANCIA. Lo que
 * sí se hace siempre es reparar los reclamos de los leases VENCIDOS: el tope
 * de una unidad (12 min) es menor que su lease (25), así que un lease vencido
 * sin soltar no puede ser de nadie vivo.
 *
 * Lease puesto y processError nulo es exactamente "una unidad que nunca soltó":
 * soltar() deja el lease en null o un error puesto. Por eso se miran también
 * los vencidos: si el servidor estuvo caído más que un lease, la foto igual
 * quedó a medias y el reclamo de reconocimiento igual hay que repararlo.
 */
async function liberarLeasesHuerfanos(): Promise<void> {
  if (!env.PROCESADOR_UNICA_INSTANCIA) {
    await repararReclamosHuerfanos({ soloVencidos: true });
    return;
  }
  // Primero la reparación: es el lease lo que dice qué unidad quedó a medias
  // y desde cuándo, y liberar lo borra.
  await repararReclamosHuerfanos({ soloVencidos: false });

  const huerfanas = await db.photo.findMany({
    where: { processLeaseUntil: { not: null }, processError: null },
    select: { id: true, processAttempts: true, processLeaseUntil: true },
  });
  for (const f of huerfanas) {
    // Las de la etapa rápida vuelven ya, como si hubieran fallado recién. Las
    // de la etapa lenta esperan lo que les toca, con el motivo anotado.
    const data =
      f.processAttempts < INTENTOS_RAPIDOS
        ? { processLeaseUntil: null }
        : { processLeaseUntil: esperaDe(f.processAttempts), processError: "reinicio: se cortó en vuelo" };
    await db.photo.updateMany({
      where: { id: f.id, processLeaseUntil: f.processLeaseUntil, processError: null },
      data,
    });
  }
  if (huerfanas.length > 0) console.log(`[cola] leases huérfanos liberados=${huerfanas.length}`);
}

/**
 * Deshacer los reclamos de reconocimiento que dejó una unidad a medias.
 *
 * runOcr y runFaceIndex ponen su columna AL RECLAMAR, antes de llamar a
 * Rekognition, para que dos procesos no paguen dos veces la misma foto. Si el
 * proceso se muere entre el reclamo y el resultado, la columna queda puesta sin
 * caras ni dorsales, y para la cola eso es "hecha": la foto no se reintenta
 * nunca y nadie la encuentra por selfie. Como los deploys cortan lo que está en
 * vuelo (ver liberarLeasesHuerfanos), esto no es raro.
 *
 * Se deshace sólo lo que se reclamó DURANTE esa unidad —desde que se tomó el
 * lease— y no dejó resultado. Si la llamada llegó a hacerse y no encontró
 * caras, se paga otra vez: una llamada por foto, como mucho tantas fotos como
 * PROCESADOR_A_LA_VEZ por reinicio, y cada reinicio le gasta un intento a la
 * foto, así que tampoco se repite sin fin. Si llegó a guardar alguna cara, no
 * se toca: reindexarla duplicaría las caras en la colección.
 *
 * Si el proceso se muere entre estas sentencias y la liberación, el próximo
 * arranque las repite: son idempotentes, y el lease sigue ahí para decir qué
 * unidad era.
 */
async function repararReclamosHuerfanos(opts: { soloVencidos: boolean }): Promise<void> {
  const leaseS = LEASE_MS / 1000;
  // Vencido: el lease ya pasó. Con una sola instancia no hace falta —todo lease
  // del arranque es de un muerto—, pero en cluster es lo único seguro.
  const todos = !opts.soloVencidos;
  const caras = await db.$executeRaw`
    update "Photo" p set "faceProcessedAt" = null
     where p."processLeaseUntil" is not null and p."processError" is null
       and (${todos}::boolean or p."processLeaseUntil" < (now() at time zone 'utc'))
       and p."faceProcessedAt" >= p."processLeaseUntil" - ${leaseS}::double precision * interval '1 second'
       and not exists (select 1 from "FaceRecord" f where f."photoId" = p.id)`;
  const dorsales = await db.$executeRaw`
    update "Photo" p set "ocrProcessedAt" = null
     where p."processLeaseUntil" is not null and p."processError" is null
       and (${todos}::boolean or p."processLeaseUntil" < (now() at time zone 'utc'))
       and p."ocrProcessedAt" >= p."processLeaseUntil" - ${leaseS}::double precision * interval '1 second'
       and p."bibNumbers" is null`;
  if (caras + dorsales > 0) {
    console.log(`[cola] reclamos a medias deshechos caras=${caras} dorsales=${dorsales}`);
  }
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

  /* SIGTERM no mata nada desde acá: deja de tomar trabajo nuevo.

     No se llama a process.exit ni se toca el handler de Next. Lo único que
     cambia es que la próxima pasada no reclama. Lo que está en vuelo termina y
     suelta su lease si le da el tiempo; casi nunca le da, porque Next sale
     apenas cierra el servidor HTTP. Esas fotos quedan con el lease puesto y
     las repara y libera el arranque siguiente. */
  const cerrar = () => {
    estado.aceptando = false;
    console.log("[cola] no se toma más trabajo (señal de cierre)");
  };
  process.once("SIGTERM", cerrar);
  process.once("SIGINT", cerrar);

  void (async () => {
    /* Con reintentos antes de arrancar el bucle. Si la reparación falla y el
       bucle arranca igual, cuando venza el lease la cola vuelve a tomar la
       foto, el reclamo nuevo pisa al viejo, y el reclamo a medias queda fuera
       de la ventana que lo identifica: perdido. Un error de conexión al
       arrancar —en este VPS pasa— no puede costar eso. */
    for (let intento = 1; intento <= 5; intento++) {
      try {
        await liberarLeasesHuerfanos();
        break;
      } catch (e) {
        console.error(`[cola] no se pudieron liberar los leases (intento ${intento}):`, e);
        if (intento < 5) await new Promise((r) => setTimeout(r, 2_000 * 2 ** intento));
      }
    }
    /* El freno vive en memoria y un proceso nuevo arranca sin él. Se borra
       también el anotado, para que el MCP no informe una pausa que ya no rige.
       Un reinicio en medio de una caída de Rekognition suele ser alguien que
       acaba de arreglar las credenciales: que pruebe ya. Si sigue roto, diez
       fallos lo vuelven a frenar. */
    anotarFreno(new Date().toISOString(), 0);
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
    // El caché no cruza el cambio de mes: un "sin cuota" de las 23:59 del 30
    // no puede dormir las fotos hasta el mes siguiente al que recién empezó.
    const hasta = Math.min(ahora + 60_000, meseQueViene(new Date(ahora)).getTime());
    estado.cuotas.set(id, { sinCuota: !tiene, hasta });
    if (!tiene) sin.push(id);
  }
  return sin;
}

/**
 * Anotar en la base que las fotos de estos dueños esperan al mes que viene.
 *
 * Es lo mismo que hace soltar() cuando una unidad se encuentra con el tope a
 * mitad de camino, pero para las que ni se llegaron a tomar. Sin esto, las
 * fotos de un fotógrafo sin cuota quedaban como pendientes comunes: la cola
 * las traía en cada pasada para descartarlas una por una, y mirando la base
 * —que es lo que hace el MCP de operaciones— eran indistinguibles de una cola
 * trabada. Anotadas, dicen por qué esperan y hasta cuándo.
 *
 * No toca processAttempts: nadie las intentó. El tope que se alcanzó es el
 * cortacircuitos de costo (RECOGNITION_HARD_CAP_MONTHLY, ver quotas.ts), no la
 * cuota comercial: si fue legítimo y se sube, reintentarVenenosas() con la
 * clase 'cuota' las despierta.
 */
async function dormirHastaElMesQueViene(ownerIds: string[], ahora: Date): Promise<void> {
  // Sólo las libres: el predicado deja afuera las que tienen un lease vigente,
  // así que esto nunca pisa una unidad en vuelo. Si falla, la pasada sigue
  // igual: las de ese dueño se descartan abajo como antes.
  const r = await db.photo
    .updateMany({
      where: { ...dondePendienteRek(ahora), ownerId: { in: ownerIds } },
      data: { processLeaseUntil: meseQueViene(ahora), processError: "cuota: tope mensual de reconocimiento" },
    })
    .catch((e: unknown) => {
      console.error("[cola] no se pudieron anotar las fotos sin cuota:", e);
      return { count: 0 };
    });
  if (r.count > 0) console.log(`[cola] sin cuota hasta el mes que viene=${r.count}`);
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
  // Con el freno puesto, sólo vistas previas: ver FRENO_FALLOS.
  if (Date.now() < estado.rekPausaHasta) return previews.map((p) => p.id);

  // Sólo si sobran lugares. Y con los dueños sin cuota afuera, para no traer
  // filas que se van a descartar una por una.
  const candidatos = await db.photo.findMany({
    where: { ...dondePendienteRek(ahora), id: { notIn: enVuelo } },
    select: { id: true, ownerId: true },
    take: PAGINA,
    orderBy: { createdAt: orden },
  });
  const sinCuota = new Set(await duenosSinCuota(candidatos.map((c) => c.ownerId)));
  if (sinCuota.size > 0) await dormirHastaElMesQueViene([...sinCuota], ahora);
  const reks = candidatos
    .filter((c) => !sinCuota.has(c.ownerId))
    .slice(0, n - previews.length)
    .map((c) => c.id);

  return [...previews.map((p) => p.id), ...reks];
}

/* ── Procesar una ───────────────────────────────────────────────────────── */

async function procesarUna(id: string, hasta: Date, signal?: AbortSignal): Promise<Salida> {
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
    const r = await generatePreview(foto.id, signal);
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

  /* Si el tope ya cortó esta unidad, no se reclama nada más.

     Cuando el tope gana la carrera, soltar() ya escribió el fallo y la espera,
     pero esta función sigue corriendo: no hay forma de matarla. Si seguía
     hasta Rekognition, reclamaba las columnas FUERA de cualquier lease, y si
     el proceso se moría en ese momento —un deploy— el reclamo quedaba puesto
     sin resultado, en una fila con error, que la reparación del arranque no
     mira. La foto quedaba "hecha" sin caras para siempre.

     Dos cercos. La señal, que corta antes de bajar bytes o de llamar. Y el
     lease en el propio reclamo (ver UnidadCola en rekognition.ts): después de
     que soltar() lo cambia, reclamar es imposible, atómicamente. Lo único que
     queda es una llamada que ya había salido cuando saltó el tope y un proceso
     que se muere antes de que vuelva: un minuto de ventana, como mucho. */
  const unidad = { lease: hasta, signal };
  const cortada = (): Salida | null =>
    signal?.aborted ? { tipo: "transitorio", motivo: "tope: pasó el tiempo máximo" } : null;

  // Una sola preparación de bytes para las dos etapas: bajar el preview limpio
  // y reencodearlo cuesta, y hacerlo dos veces no aporta nada.
  const bytes = await bytesParaRekognition(foto, signal);
  if (!bytes) return cortada() ?? { tipo: "transitorio", motivo: "s3: no se pudieron leer los bytes" };

  let ocr: EstadoRek | null = null;
  let caras: EstadoRek | null = null;
  if (faltaOcr) {
    const r = await runOcr(foto.id, bytes, unidad);
    ocr = r.estado;
    // evaluarDorsales sólo cuando de verdad hubo lectura: es lo que decide
    // apagar el OCR del evento, y decidir con una muestra de fallos apagaría
    // la búsqueda por dorsal de un evento que sí los tiene.
    if (r.estado === "hecha") {
      await evaluarDorsales(foto.eventId).catch((e: unknown) =>
        console.error("[cola] evaluarDorsales:", e),
      );
    }
  }
  if (faltaCaras && ocr !== "cortada") {
    const r = await runFaceIndex(foto.id, foto.eventId, bytes, unidad);
    caras = r.estado;
  }
  const estados = [ocr, caras].filter((e): e is EstadoRek => e !== null);
  anotarRek(estados);

  if (estados.includes("cortada")) return cortada() ?? { tipo: "transitorio", motivo: "tope: pasó el tiempo máximo" };
  // Sin cuota manda sobre todo lo demás: no es un fallo de la foto.
  if (estados.includes("sin_cuota")) {
    return { tipo: "sin_cuota", motivo: "cuota: tope mensual de reconocimiento" };
  }
  if (estados.includes("error")) {
    await asegurarReclamosSueltos(foto.id, hasta, { ocr: ocr === "error", caras: caras === "error" });
    return { tipo: "transitorio", motivo: "rek: falló una llamada" };
  }
  /* Un 'permanente' de Rekognition NO bloquea la foto: la columna quedó puesta
     y esa etapa no se vuelve a intentar, pero la foto ya se ve y se vende.

     Sí se anota. Sin la anotación, una foto que Rekognition rechaza es
     idéntica en la base a una foto sin caras ni dorsal, y nadie se entera de
     que no se puede encontrar. El prefijo "rekperm:" es lo que cuenta el MCP de
     operaciones; la cola no lo lee. Si en la misma unidad la otra etapa falla,
     el aviso se pierde —reclamar borra processError— y la foto sale sólo por
     la proporción sin caras del MCP. */
  if (estados.includes("permanente")) {
    return { tipo: "ok", aviso: "rekperm: Rekognition rechazó la imagen" };
  }
  return { tipo: "ok" };
}

/**
 * Soltar de nuevo los reclamos de las etapas que fallaron.
 *
 * runOcr y runFaceIndex ya sueltan su columna cuando la llamada falla, pero esa
 * escritura se traga su propio error. Si la llamada a Rekognition falló por la
 * red, es justo cuando más probable es que la escritura también falle; y una
 * columna que queda puesta sin resultado es, para la cola, una foto "hecha":
 * no se reintenta nunca y nadie la encuentra. Acá se repite, con el lease de
 * esta unidad en el where —si ya no es nuestra, no se toca—. Como los reclamos
 * también llevan el lease, mientras esta unidad lo tenga nadie más pudo haber
 * reclamado, así que la columna puesta sólo puede ser la nuestra.
 */
async function asegurarReclamosSueltos(
  id: string,
  hasta: Date,
  etapas: { ocr: boolean; caras: boolean },
): Promise<void> {
  try {
    if (etapas.caras) {
      await db.photo.updateMany({
        where: { id, processLeaseUntil: hasta, faceProcessedAt: { not: null }, faceRecords: { none: {} } },
        data: { faceProcessedAt: null },
      });
    }
    if (etapas.ocr) {
      await db.photo.updateMany({
        where: { id, processLeaseUntil: hasta, ocrProcessedAt: { not: null } },
        data: { ocrProcessedAt: null },
      });
    }
  } catch (e) {
    // Si esto también falla, la base no contesta: soltar() va a fallar igual,
    // el lease queda puesto con processError nulo, y el próximo arranque lo
    // repara con repararReclamosHuerfanos.
    console.error("[cola] no se pudieron soltar los reclamos", id, e);
  }
}

/** Lleva la cuenta del freno con lo que devolvieron las etapas de una foto. */
function anotarRek(estados: EstadoRek[]): void {
  if (estados.includes("hecha")) {
    estado.rekFallosSeguidos = 0;
    return;
  }
  if (!estados.includes("error")) return;
  estado.rekFallosSeguidos++;
  if (estado.rekFallosSeguidos < FRENO_FALLOS) return;

  estado.rekPausaHasta = Date.now() + FRENO_PAUSA_MS;
  // Al volver prueba con una: un solo fallo más vuelve a frenar.
  estado.rekFallosSeguidos = FRENO_FALLOS - 1;
  const hasta = new Date(estado.rekPausaHasta).toISOString();
  console.error(`[cola] freno del reconocimiento: ${FRENO_FALLOS} fallos seguidos de Rekognition, pausa hasta ${hasta}`);
  // Nunca puede tirar: que no se pueda anotar no cambia que el freno está puesto.
  anotarFreno(hasta, FRENO_FALLOS);
  // Al vencer, la prueba sale en el momento: si no, la cola ociosa podía dormir
  // hasta diez minutos más, y el MCP veía fotos esperando sin freno puesto.
  setTimeout(despertar, FRENO_PAUSA_MS + 1_000).unref?.();
}

/**
 * Lo que ve el MCP de operaciones. Nunca puede tirar: que no se pueda anotar no
 * cambia lo que la cola hace.
 */
function anotarFreno(hasta: string, fallos: number): void {
  const value = JSON.stringify({ hasta, fallos });
  void db.setting
    .upsert({ where: { key: CLAVE_FRENO }, update: { value }, create: { key: CLAVE_FRENO, value } })
    .catch(() => undefined);
}

/**
 * Con tope de tiempo, y el tope es menor que el lease.
 *
 * Los timeouts de S3 y Rekognition hacen que ninguna etapa se cuelgue sola,
 * pero esto es el cinturón: lo que sea que tarde más de cuatro minutos no va a
 * terminar bien, y dejarlo correr retiene un permiso del semáforo de sharp.
 */
async function procesarConTope(id: string, hasta: Date): Promise<Salida> {
  /* El tope avisa, además de dejar de esperar.

     Antes era sólo un Promise.race: el trabajo perdedor seguía corriendo, con
     su original de 16 MB en memoria y su permiso del semáforo tomado, hasta
     que terminaba solo. Con cuatro fotos en vuelo eso se acumula, el servidor
     se queda sin memoria, todo se vuelve más lento, y más fotos pasan el tope.
     Se alimenta a sí mismo y no se recupera hasta que alguien reinicia; fue lo
     que dejó dos álbumes de un fotógrafo con las fotos invisibles.

     Interrumpir una operación de sharp que ya arrancó no se puede. Lo que sí
     se puede es cortar la descarga de S3 y no arrancar lo que falta, que es
     casi todo: los encodes que quedan y las tres subidas. */
  const corte = new AbortController();
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<Salida>((resolve) => {
    reloj = setTimeout(() => {
      corte.abort();
      resolve({ tipo: "transitorio", motivo: "tope: pasó el tiempo máximo" });
    }, TOPE_UNIDAD_MS);
    reloj.unref?.();
  });
  try {
    // La perdedora no termina en el acto, pero su rechazo no puede quedar
    // suelto: un unhandledRejection en Next tumba el proceso entero.
    return await Promise.race([
      procesarUna(id, hasta, corte.signal).catch((e: unknown) => ({
        tipo: "transitorio" as const,
        motivo: `error: ${e instanceof Error ? e.message : String(e)}`,
      })),
      tope,
    ]);
  } finally {
    clearTimeout(reloj);
    corte.abort();
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
        const r = await procesarConTope(id, hasta);
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
      `enfriandose=${r.enfriandose} despacio=${r.reintentandoDespacio} ` +
      `venenosas=${r.venenosas} venenosasRek=${r.venenosasRek} masViejaMin=${r.masViejaMin ?? "-"}`,
  );
}

async function resumen(): Promise<Resumen> {
  const ahora = new Date();
  // En una transacción y no en un Promise.all: son siete consultas por minuto,
  // y en paralelo ocupaban siete de las diez conexiones del pool que comparte
  // con el sitio. Así usan una, una atrás de la otra.
  const [
    pendientesPreview,
    pendientesRek,
    enfriandose,
    reintentandoDespacio,
    venenosas,
    venenosasRek,
    masVieja,
  ] = await db.$transaction([
    db.photo.count({ where: dondePendientePreview(ahora) }),
    db.photo.count({ where: dondePendienteRek(ahora) }),
    db.photo.count({
      where: { processLeaseUntil: { gt: ahora }, processError: { not: null } },
    }),
    db.photo.count({
      where: {
        processAttempts: { gte: INTENTOS_RAPIDOS, lt: MAX_INTENTOS },
        processLeaseUntil: { gt: ahora },
        processError: { not: null },
        NOT: { processError: { startsWith: "cuota" } },
        deletedAt: null,
      },
    }),
    db.photo.count({ where: dondeApartadaPreview() }),
    db.photo.count({
      where: {
        processAttempts: { gte: MAX_INTENTOS },
        previewKey: { not: null },
        fileSize: { not: null },
        deletedAt: null,
        event: { recognition: true },
        OR: [
          { faceProcessedAt: null },
          { AND: [{ event: { bibDetection: true } }, { ocrProcessedAt: null }] },
        ],
      },
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
    reintentandoDespacio,
    venenosas,
    venenosasRek,
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
    frenoReconocimientoHasta:
      estado.rekPausaHasta > Date.now() ? new Date(estado.rekPausaHasta).toISOString() : null,
    // Los tiempos por etapa de las últimas fotos. También quedan en
    // Setting "procesador:tiempos", que es lo que se puede mirar sin entrar
    // al servidor.
    tiempos: ultimosTiempos(),
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
  // Con los dos puntos: la clase es el prefijo hasta ':', y sin ellos 'rek'
  // también se llevaba las 'rekperm:', que no se reintentan.
  const clase = (opts.clase ?? "cuota").replace(/:$/, "");
  const r = await db.photo.updateMany({
    where: {
      ...(opts.eventId ? { eventId: opts.eventId } : {}),
      deletedAt: null,
      processError: { startsWith: `${clase}:` },
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
      // Lo mismo que le falta a una foto según dondePendienteRek: también las
      // que tienen las caras pero no el dorsal, que si no quedaban afuera.
      OR: [
        { faceProcessedAt: null },
        { AND: [{ event: { bibDetection: true } }, { ocrProcessedAt: null }] },
      ],
    },
    data: { processAttempts: 0, processLeaseUntil: null, processError: null },
  });
  if (r.count > 0) despertar();
  return r.count;
}
