import "server-only";

import sharp from "sharp";

import { env } from "~/env";
import {
  hacerDerivados,
  PREVIEW_MAX_WIDTH,
  type PedidoDerivados,
} from "~/server/derivados";
import { contarLocal, derivadosEnLambda, lambdaConfigurada } from "~/server/derivados-lambda";
import { cronometro } from "~/server/diagnostico";
import { db } from "~/server/db";
import { capaParaFoto, leerConfigMarca, unidadParaFoto, type ConfigMarca, type Unidad } from "~/server/marca-agua";
import {
  deleteS3Objects,
  getS3ObjectBytes,
  platformWatermarkKey,
  previewCleanPhotoKey,
  previewPhotoKey,
  putS3Object,
  thumbPhotoKey,
  CACHE_MOSTRAR,
  userWatermarkKey,
  headObject,
} from "~/server/s3";

/* Las medidas, calidades y opciones de sharp de los derivados viven en
   derivados.ts, que comparten este archivo y la Lambda de derivados. */

/* libvips abre un hilo por núcleo POR OPERACIÓN, y acá hay varias a la vez.

   En una máquina de 16 núcleos eso son 16 hilos por foto y hasta 48 a la vez,
   peleándose por un VPS que además sirve el sitio. El trabajo por foto es
   chico —un resize y cuatro encodes— así que repartirlo en más hilos no lo
   hace más rápido, sólo agrega cambios de contexto y picos de memoria. El
   paralelismo que sí queremos es entre fotos, y ése lo gobierna el semáforo
   de más abajo.

   La caché de libvips también se acota: guarda operaciones y buffers, y en una
   tanda de cuatrocientas fotos distintas no reusa nada, así que son 50 MB
   retenidos para nada. */
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 50 });

// ── Concurrency limiter ───────────────────────────────────────────────────────
// Sharp is CPU + memory intensive. Without a cap, uploading 50 photos at once
// fires 50 concurrent resize+watermark operations, which OOMs the VPS and
// produces 502s. El turno cubre sólo el trabajo de imagen: la descarga y la
// subida de cada foto corren afuera (ver generatePreview).
export const MAX_CONCURRENT = 2;

/* El contador vive en globalThis, como el bus de ventas y el cliente de Prisma.

   No es manía: instrumentation.ts —donde va a arrancar el procesador— y los
   route handlers se compilan en capas distintas de webpack, así que este
   módulo se evalúa DOS veces y un `let active` de módulo serían dos contadores
   de 3. Seis decodes de 24 MP a la vez es exactamente el escenario que el
   comentario de arriba dice que hizo OOM y 502. */
declare global {
  var __cuervito_sharp__: { active: number; waitQueue: Array<() => void> } | undefined;
}
const sem = (globalThis.__cuervito_sharp__ ??= { active: 0, waitQueue: [] });

export function tomarSlotSharp(): Promise<void> {
  return new Promise((resolve) => {
    if (sem.active < MAX_CONCURRENT) { sem.active++; resolve(); }
    else sem.waitQueue.push(() => { sem.active++; resolve(); });
  });
}

export function soltarSlotSharp() {
  sem.active--;
  sem.waitQueue.shift()?.();
}

// ── Watermark cache ───────────────────────────────────────────────────────────
// We keep one entry for the platform watermark and one per user who has their
// own. TTL is 60 s so a new upload is reflected quickly without hammering S3.

/* También se guarda que NO hay: sin eso, un fotógrafo sin marca propia —casi
   todos— le preguntaba a S3 por un archivo que no existe en cada foto, y eso
   era medio segundo de cada foto que hace la Lambda. Sólo cuando S3 contesta
   que el archivo no existe: un error pasajero no se guarda, porque durante un
   minuto las fotos de alguien CON marca propia saldrían con la de la
   plataforma. */
interface CacheEntry { bytes: Buffer | null; loadedAt: number }

function noExiste(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}
/* En globalThis, como el semáforo de arriba y la configuración de la marca.

   Con un `let` de módulo, la ruta que sube la marca vaciaba SU copia y el
   procesador —la otra capa de webpack— seguía un minuto con la de antes: las
   fotos subidas justo después de cambiar la marca propia de un fotógrafo, y
   todo lo que la cola tomara en ese minuto, salían con la marca vieja. */
declare global {
  var __cuervito_marcas__:
    | { plataforma: CacheEntry | null; fotografos: Map<string, CacheEntry> }
    | undefined;
}
const marcas = (globalThis.__cuervito_marcas__ ??= {
  plataforma: null,
  fotografos: new Map<string, CacheEntry>(),
});
const CACHE_TTL_MS = 60_000;

export async function loadPlatformWatermark(): Promise<Buffer | null> {
  const cached = marcas.plataforma;
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.bytes;
  try {
    const bytes = await getS3ObjectBytes(platformWatermarkKey());
    const buf = Buffer.from(bytes);
    marcas.plataforma = { bytes: buf, loadedAt: Date.now() };
    return buf;
  } catch (err) {
    if (noExiste(err)) marcas.plataforma = { bytes: null, loadedAt: Date.now() };
    return null;
  }
}

export async function loadUserWatermark(userId: string): Promise<Buffer | null> {
  const cached = marcas.fotografos.get(userId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.bytes;
  try {
    const bytes = await getS3ObjectBytes(userWatermarkKey(userId));
    const buf = Buffer.from(bytes);
    marcas.fotografos.set(userId, { bytes: buf, loadedAt: Date.now() });
    return buf;
  } catch (err) {
    if (noExiste(err)) marcas.fotografos.set(userId, { bytes: null, loadedAt: Date.now() });
    return null;
  }
}

/** Invalidate the in-process cache for the platform watermark. */
export function invalidateWatermarkCache() {
  marcas.plataforma = null;
}

/** Invalidate the per-user cache entry (call after the user uploads/deletes). */
export function invalidateUserWatermarkCache(userId: string) {
  marcas.fotografos.delete(userId);
}

/**
 * La capa de marca de agua para una foto de este tamaño.
 *
 * La marca propia del fotógrafo, si subió una, va sola: es su logo y no lleva
 * el texto de la plataforma debajo. Si no, va la de la plataforma con la
 * configuración del admin: el PNG subido o el logo de encontrate, el texto, y
 * el patrón. Todo lo que antes estaba fijo acá (40 % del lado menor, -35°,
 * mosaico) ahora está en [marca-agua.ts] y se edita desde /admin/watermark.
 */
async function buildComposite(
  imageWidth: number,
  imageHeight: number,
  ownerId?: string,
): Promise<sharp.OverlayOptions> {
  const { imagen, cfg, conTexto } = await elegirMarca(ownerId);
  return capaParaFoto({ anchoFoto: imageWidth, altoFoto: imageHeight, imagen, cfg, conTexto });
}

/**
 * Qué marca lleva una foto de este fotógrafo. Una sola función para el camino
 * del VPS y para lo que se le manda a la Lambda: si la elección estuviera
 * escrita dos veces, el día que se corrija en una sola las fotos saldrían
 * marcadas distinto según quién las procesó.
 */
async function elegirMarca(
  ownerId?: string,
): Promise<{ imagen: Buffer | null; cfg: ConfigMarca; conTexto: boolean }> {
  const propia = ownerId ? await loadUserWatermark(ownerId) : null;
  const cfg = await leerConfigMarca();
  const imagen = propia ?? (cfg.fuente === "subida" ? await loadPlatformWatermark() : null);
  return { imagen, cfg, conTexto: !propia };
}

/**
 * La unidad de la marca para una foto de este ancho, con la misma elección que
 * buildComposite: la marca propia del fotógrafo sola, o la de la plataforma
 * con su texto. Es lo que viaja armado a la Lambda.
 */
async function unidadDeLaMarca(
  ownerId: string,
  anchoFoto: number,
): Promise<{ unidad: Unidad; cfg: ConfigMarca }> {
  const { imagen, cfg, conTexto } = await elegirMarca(ownerId);
  const unidad = await unidadParaFoto({ anchoFoto, imagen, cfg, conTexto });
  return { unidad, cfg };
}

/**
 * Read an original from S3, watermark it, write the .webp preview to S3,
 * update Photo.previewKey + previewGeneratedAt. Returns the new preview key
 * or null if the original couldn't be processed.
 */
/** Resultado de generar las previews de una foto.
 *  `rekognitionBytes` queda siempre en null: era un JPEG para que el
 *  reconocimiento no volviera a bajar la foto, pero la cola hace el
 *  reconocimiento en otra vuelta y baja la vista previa limpia por su cuenta,
 *  así que nadie lo usaba y costaba un encode por foto. */
export type PreviewResult = {
  watermarkedKey: string | null;
  rekognitionBytes: Uint8Array | null;
  /** Por qué no se pudo. `permanente` significa que reintentar no sirve. */
  error?: { mensaje: string; permanente: boolean };
};

/* El turno de sharp se toma adentro, y sólo para el trabajo de imagen.

   Antes se tomaba acá, antes de todo, y cubría también la descarga del
   original y la subida de los tres derivados. Con originales de 15 MB, bajar
   uno tarda unos diez segundos y el trabajo de imagen unos cuatro: cada foto
   tenía el turno tomado el 70 % del tiempo esperando a la red, con el
   procesador parado, y con dos turnos pasaban dos fotos a la vez. Así, las
   descargas corren en paralelo fuera del turno y el turno se usa para lo que
   existe: que no haya más de dos decodes de 24 MP en memoria a la vez. */
export async function generatePreview(
  photoId: string,
  signal?: AbortSignal,
): Promise<PreviewResult> {
  return _generatePreview(photoId, signal);
}

/** Abandonada por quien la pidió: no tiene sentido seguir gastando en ella. */
const ABORTADO: PreviewResult = {
  watermarkedKey: null,
  rekognitionBytes: null,
  error: { mensaje: "abandonado por tiempo", permanente: false },
};

/**
 * Este fallo, reintentado, da lo mismo?
 *
 * Es la diferencia entre "no pude" y "no voy a poder nunca". Un archivo que no
 * es una imagen, o que se pasa del límite de píxeles, no mejora en el segundo
 * intento: reintentarlo es bajar 15 MB de S3 cada vez, para siempre. Una caída
 * de red sí mejora.
 */
function esPermanente(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /unsupported image format|VipsJpeg|premature end|input buffer|pixel limit|unsupported/i.test(m);
}

async function _generatePreview(
  photoId: string,
  signal?: AbortSignal,
): Promise<PreviewResult> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      eventId: true,
      ownerId: true,
      storageKey: true,
      previewKey: true,
      previewCleanKey: true,
      thumbKey: true,
    },
  });
  if (!photo) {
    return {
      watermarkedKey: null,
      rekognitionBytes: null,
      error: { mensaje: "la foto ya no está en la base", permanente: true },
    };
  }

  const reloj = cronometro();
  reloj.marca("base");
  if (signal?.aborted) return ABORTADO;

  const claves = {
    marcada: previewPhotoKey(photo.ownerId, photo.eventId, photo.id),
    limpia: previewCleanPhotoKey(photo.ownerId, photo.eventId, photo.id),
    miniatura: thumbPhotoKey(photo.ownerId, photo.eventId, photo.id),
  };
  /* Sólo las que no se van a pisar. Al regenerar, las claves viejas son las
     mismas que las nuevas: borrarlas antes de escribir dejaba la foto sin
     vista previa en la tienda mientras se procesaba, y para siempre si la
     subida fallaba, con la base apuntando a un archivo que ya no estaba. */
  const nuevas = new Set(Object.values(claves));
  const viejas = [photo.previewKey, photo.previewCleanKey, photo.thumbKey].filter(
    (k): k is string => !!k && !nuevas.has(k),
  );

  // Primero la Lambda, si está: al lado de S3 esto tarda segundos y no usa el
  // procesador del VPS. Si no está o falla, se sigue acá como siempre.
  // Por qué no la hizo la Lambda, si se le pidió: una foto angosta le toca al
  // VPS por diseño y no cuenta como que la Lambda falló.
  let porQueLocal: string | null = null;
  if (lambdaConfigurada()) {
    const intento = await enLambda(photo, claves, viejas, reloj, signal);
    if (typeof intento !== "string") return intento;
    porQueLocal = intento;
    if (signal?.aborted) {
      reloj.cerrar(photoId, "abortada", { detalle: "lambda" });
      return ABORTADO;
    }
  }

  let raw: Uint8Array;
  try {
    raw = await getS3ObjectBytes(photo.storageKey, { signal });
  } catch (err) {
    reloj.cerrar(photoId, signal?.aborted ? "abortada" : "error", {
      detalle: err instanceof Error ? err.message : String(err),
    });
    if (signal?.aborted) return ABORTADO;
    console.error("[watermark] download failed:", photo.storageKey, err);
    // Transitorio salvo que el objeto de verdad no esté: la red se cae, S3
    // tiene un mal momento. Si no está, no va a aparecer reintentando.
    const h = await headObject(photo.storageKey);
    return {
      watermarkedKey: null,
      rekognitionBytes: null,
      error: {
        mensaje: err instanceof Error ? err.message : String(err),
        permanente: h.estado === "no-existe",
      },
    };
  }

  /* Sin copiar: Buffer.from(Uint8Array) duplica, y son 16 MB por foto que
     quedan vivos hasta que termina todo. Envolver el mismo ArrayBuffer no
     copia nada, y sharp no escribe sobre lo que le entra. */
  reloj.marca("descarga");
  const buf = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  if (signal?.aborted) {
    reloj.cerrar(photoId, "abortada", { bytes: raw.byteLength });
    return ABORTADO;
  }

  // Recién ahora el turno, con los bytes ya en memoria (ver generatePreview).
  await tomarSlotSharp();
  let conTurno = true;
  const soltarTurno = () => {
    if (!conTurno) return;
    conTurno = false;
    soltarSlotSharp();
  };
  reloj.marca("turno");

  try {
    if (signal?.aborted) {
      reloj.cerrar(photoId, "abortada", { bytes: raw.byteLength });
      return ABORTADO;
    }

    // Sin el JPEG para Rekognition: nadie lo usaba, y el reconocimiento
    // baja la vista previa limpia por su cuenta.
    const d = await hacerDerivados(buf, (ancho, alto) => buildComposite(ancho, alto, photo.ownerId), {
      reloj,
    });
    // El trabajo de imagen terminó: lo que sigue es red y base, sin turno.
    soltarTurno();

    /* El trabajo pesado terminó. Si quien la pidió ya se cansó, no se sube
       nada ni se toca la base: la foto queda como estaba y la próxima pasada
       la vuelve a tomar entera. */
    if (signal?.aborted) {
      reloj.cerrar(photoId, "abortada", { bytes: raw.byteLength });
      return ABORTADO;
    }

    // Delete stale previews before writing new ones
    if (viejas.length > 0) {
      await deleteS3Objects(viejas).catch(() => undefined);
    }
    reloj.marca("borrar-viejas");

    await Promise.all([
      putS3Object(claves.limpia, d.limpia, "image/webp", CACHE_MOSTRAR),
      putS3Object(claves.marcada, d.marcada, "image/webp", CACHE_MOSTRAR),
      putS3Object(claves.miniatura, d.miniatura, "image/webp", CACHE_MOSTRAR),
    ]);
    reloj.marca("subir");

    await registrarDerivados(photo.id, claves, d.ancho, d.alto);
    if (porQueLocal !== "angosta") contarLocal();

    reloj.cerrar(photoId, "ok", { bytes: raw.byteLength });
    return { watermarkedKey: claves.marcada, rekognitionBytes: null };
  } catch (err) {
    reloj.cerrar(photoId, signal?.aborted ? "abortada" : "error", {
      bytes: raw.byteLength,
      detalle: err instanceof Error ? err.message : String(err),
    });
    const permanente = esPermanente(err);
    console.error(
      `[watermark] error for photoId=${photo.id} permanente=${permanente}:`,
      err,
    );
    return {
      watermarkedKey: null,
      rekognitionBytes: null,
      error: {
        mensaje: err instanceof Error ? err.message : String(err),
        permanente,
      },
    };
  } finally {
    soltarTurno();
  }
}

type Claves = { marcada: string; limpia: string; miniatura: string };

/**
 * Los mismos derivados, hechos por la Lambda. Si hay que hacerlos acá, el
 * porqué: no está configurada, está en pausa, falló, o la foto es de un ancho
 * para el que la unidad que se le manda no sirve ("angosta").
 */
async function enLambda(
  photo: { id: string; ownerId: string; storageKey: string },
  claves: Claves,
  viejas: string[],
  reloj: ReturnType<typeof cronometro>,
  signal?: AbortSignal,
): Promise<PreviewResult | string> {
  if (!env.AWS_S3_BUCKET) return "sin-bucket";
  let pedido: PedidoDerivados;
  try {
    const { unidad, cfg } = await unidadDeLaMarca(photo.ownerId, PREVIEW_MAX_WIDTH);
    pedido = {
      bucket: env.AWS_S3_BUCKET,
      original: photo.storageKey,
      claves,
      viejas,
      anchoEsperado: PREVIEW_MAX_WIDTH,
      unidad: { png: unidad.png.toString("base64"), ancho: unidad.ancho, alto: unidad.alto },
      cfg,
      cacheControl: CACHE_MOSTRAR,
    };
  } catch (e) {
    console.warn("[watermark] no se pudo armar la marca para la Lambda:", e);
    return "sin-marca";
  }
  reloj.marca("unidad");

  const t0 = Date.now();
  const resultado = await derivadosEnLambda(pedido, signal);
  if (!resultado.ok) {
    // El tiempo del intento con su nombre, para que no se sume a la descarga
    // del VPS que viene después.
    if (resultado.por !== "apagada" && resultado.por !== "pausa") reloj.marca(`lambda-${resultado.por}`);
    return resultado.por;
  }
  const r = resultado.respuesta;
  // Las etapas de adentro de la Lambda con su prefijo —la descarga de ahí no
  // es la del VPS, que es la que vigila el MCP—, y lo que costó ir y volver
  // como "lambda".
  const adentro = Object.values(r.etapas).reduce((a, b) => a + b, 0);
  reloj.agregar({
    ...Object.fromEntries(Object.entries(r.etapas).map(([k, v]) => [`lambda:${k}`, v])),
    lambda: Math.max(0, Date.now() - t0 - adentro),
  });

  try {
    await registrarDerivados(photo.id, claves, r.ancho, r.alto);
  } catch (e) {
    // Los archivos ya están en S3 con las claves de siempre: la próxima pasada
    // los vuelve a escribir igual. Se devuelve como fallo transitorio.
    reloj.cerrar(photo.id, "error", { bytes: r.bytes, detalle: "lambda: no se pudo registrar" });
    return {
      watermarkedKey: null,
      rekognitionBytes: null,
      error: { mensaje: e instanceof Error ? e.message : String(e), permanente: false },
    };
  }
  reloj.cerrar(photo.id, "ok", { bytes: r.bytes, detalle: "lambda" });
  return { watermarkedKey: claves.marcada, rekognitionBytes: null };
}

async function registrarDerivados(id: string, claves: Claves, ancho: number, alto: number): Promise<void> {
  await db.photo.update({
    where: { id },
    data: {
      previewKey: claves.marcada,
      previewCleanKey: claves.limpia,
      // La miniatura SE SUBÍA a S3 y no se guardaba acá, así que para la base
      // no existía: 2.620 fotos con el archivo de 56 KB sentado en el bucket
      // mientras la grilla les servía el preview de 845 KB. Todo el trabajo de
      // agosto para que la galería abriera rápido se apagó solo, sin romper
      // nada, sin un error en ningún lado.
      thumbKey: claves.miniatura,
      previewGeneratedAt: new Date(),
      width: ancho,
      height: alto,
    },
  });
}
