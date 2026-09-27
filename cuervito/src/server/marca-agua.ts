import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createElement } from "react";
import satori from "satori";
import sharp from "sharp";

import { db } from "~/server/db";
import { fuentesSatori } from "~/server/historias/fuentes";
import { rasterizarCapa, superponer, type Capa, type Unidad } from "~/server/marca-agua-capa";
import { CONFIG_POR_DEFECTO, esquemaConfig, type ConfigMarca } from "~/server/marca-agua-config";

// El patrón y la capa viven en un módulo sin servidor, que comparte la Lambda.
export { capaMarca, type Capa, type Unidad } from "~/server/marca-agua-capa";

/**
 * La marca de agua de la plataforma: qué se estampa y cómo.
 *
 * Antes era una sola cosa fija: el PNG que subía el admin, escalado al 40 %
 * del lado menor, rotado 35 grados y repetido en mosaico. Sin separación, sin
 * opacidad, sin texto, y con "CUERVITO" de respaldo si no había PNG.
 *
 * Ahora son dos cosas separadas:
 *
 *   · la UNIDAD: la imagen —el PNG subido, o el logo de encontrate si no hay
 *     ninguno— con un texto debajo, renderizado con la tipografía de la marca.
 *   · el PATRÓN: cómo se reparte la unidad sobre la foto. Es un SVG del tamaño
 *     de la foto con un <pattern>, así que escala, rotación, separación y
 *     opacidad son geometría declarada y no un bucle de composites.
 *
 * La configuración vive en Setting como JSON y la lee cada preview que se
 * genera. Cambiarla afecta a todo lo que se procese de ahí en más; lo ya
 * procesado se regenera desde el admin.
 */

/* ── La configuración ───────────────────────────────────────────────────── */

export {
  CONFIG_POR_DEFECTO,
  esquemaConfig,
  PATRONES,
  PATRONES_LISTA,
  type ConfigMarca,
  type Patron,
} from "~/server/marca-agua-config";

export const CLAVE_CONFIG_MARCA = "watermark:config";

/* La configuración y las unidades armadas viven en globalThis, como todo lo
   que comparten el procesador de fotos (que arranca en instrumentation.ts) y
   las rutas: son dos capas de webpack y un `let` de módulo serían dos copias.

   No se usa unstable_cache porque el procesador la pide fuera de cualquier
   request, y ahí unstable_cache no tiene dónde guardar y lanza. Es un TTL
   corto a mano; guardar la config la vacía en el acto, y como corre una sola
   instancia, "en el acto" alcanza. */
declare global {
  var __cuervito_marca__:
    | {
        cfg: { valor: ConfigMarca; leidaEn: number } | null;
        unidades: Map<string, Unidad>;
        capas: Map<string, Capa>;
      }
    | undefined;
}
const estado = (globalThis.__cuervito_marca__ ??= {
  cfg: null,
  unidades: new Map<string, Unidad>(),
  capas: new Map<string, Capa>(),
});
const CFG_TTL_MS = 15_000;

export function analizarConfig(crudo: unknown): ConfigMarca {
  const p = esquemaConfig.safeParse(crudo);
  return p.success ? p.data : CONFIG_POR_DEFECTO;
}

export async function leerConfigMarca(): Promise<ConfigMarca> {
  if (estado.cfg && Date.now() - estado.cfg.leidaEn < CFG_TTL_MS) return estado.cfg.valor;
  const fila = await db.setting.findUnique({
    where: { key: CLAVE_CONFIG_MARCA },
    select: { value: true },
  });
  let valor = CONFIG_POR_DEFECTO;
  if (fila) {
    try {
      valor = analizarConfig(JSON.parse(fila.value));
    } catch {
      valor = CONFIG_POR_DEFECTO;
    }
  }
  estado.cfg = { valor, leidaEn: Date.now() };
  return valor;
}

export async function guardarConfigMarca(cfg: ConfigMarca): Promise<void> {
  const value = JSON.stringify(cfg);
  await db.setting.upsert({
    where: { key: CLAVE_CONFIG_MARCA },
    update: { value },
    create: { key: CLAVE_CONFIG_MARCA, value },
  });
  estado.cfg = null;
  estado.unidades.clear();
  estado.capas.clear();
}

export function vaciarCacheMarca(): void {
  estado.cfg = null;
  estado.unidades.clear();
  estado.capas.clear();
}

/* ── La unidad ──────────────────────────────────────────────────────────── */

/** El logo de encontrate, para cuando no hay PNG subido. */
export async function logoPorDefecto(color: ConfigMarca["color"]): Promise<Buffer> {
  const archivo = color === "tinta" ? "logo-tinta.png" : "logo.png";
  return readFile(path.join(process.cwd(), "public/marca", archivo));
}

/**
 * La unidad: la imagen a un ancho dado, con el texto debajo.
 *
 * El texto se renderiza con satori y no con el <text> de SVG porque sharp
 * rasteriza el SVG con las fuentes del sistema —en el VPS, ninguna de las
 * nuestras— y satori convierte las letras en trazos con las fuentes que
 * llevamos en el repo. Es el mismo camino que usan las historias.
 *
 * Una unidad por (imagen, texto, ancho) queda en caché: armarla son dos
 * renders y un composite, y una tanda de subida pide la misma cientos de
 * veces seguidas.
 */
export async function armarUnidad(opts: {
  imagen: Buffer | null;
  cfg: ConfigMarca;
  /** Ancho de la unidad en píxeles, ya calculado sobre la foto. */
  ancho: number;
  /** Con texto o sin él: la marca de un fotógrafo va sola. */
  conTexto: boolean;
}): Promise<Unidad> {
  const { cfg } = opts;
  const ancho = Math.max(24, Math.round(opts.ancho));
  const texto = opts.conTexto ? cfg.texto.trim() : "";
  const imagen = opts.imagen ?? (await logoPorDefecto(cfg.color));
  const clave = createHash("sha1")
    .update(imagen.subarray(0, 4096))
    .update(String(imagen.length))
    .update(`|${ancho}|${texto}|${cfg.textoEscala}|${cfg.color}`)
    .digest("hex");

  const hecha = estado.unidades.get(clave);
  if (hecha) return hecha;

  const img = await sharp(imagen, { limitInputPixels: 60_000_000 })
    .resize({ width: ancho, withoutEnlargement: false })
    .png()
    .toBuffer();
  const im = await sharp(img).metadata();
  const imgAlto = im.height ?? Math.round(ancho / 3);

  let unidad: Unidad;

  if (texto) {
    const tam = Math.max(10, Math.round(ancho * cfg.textoEscala));
    const color = cfg.color === "tinta" ? "#12110F" : "#FFFFFF";
    const altoTexto = Math.round(tam * 1.3);
    const svg = await satori(
      createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: ancho,
            height: altoTexto,
            fontFamily: "Outfit",
            fontWeight: 600,
            fontSize: tam,
            letterSpacing: "-0.01em",
            color,
            whiteSpace: "nowrap",
          },
        },
        texto,
      ),
      { width: ancho, height: altoTexto, fonts: await fuentesSatori() },
    );
    const textoPng = await sharp(Buffer.from(svg)).png().toBuffer();
    const gap = Math.round(tam * 0.25);
    const alto = imgAlto + gap + altoTexto;

    const png = await sharp({
      create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: img, top: 0, left: 0 },
        { input: textoPng, top: imgAlto + gap, left: 0 },
      ])
      .png()
      .toBuffer();
    unidad = { png, ancho, alto };
  } else {
    unidad = { png: img, ancho, alto: imgAlto };
  }

  if (estado.unidades.size > 64) estado.unidades.clear();
  estado.unidades.set(clave, unidad);
  return unidad;
}

/* ── La capa, armada una sola vez ───────────────────────────────────────── */

/* Dos entradas: un evento son fotos apaisadas y verticales, y nada más. Cada
   una ocupa ancho×alto×4 bytes —unos 15 MB para 2400×1600— y eso es barato
   comparado con lo que costaba rasterizarla de nuevo en cada foto. */
const CAPAS_MAX = 2;

/**
 * Todo junto: la capa lista para una foto de este tamaño.
 *
 * `imagen` es el PNG subido (de la plataforma o del fotógrafo) o null para
 * usar el logo de encontrate. `conTexto` va en false para la marca de un
 * fotógrafo: su logo con "encontrate.app" debajo no es de nadie.
 *
 * La capa se rasteriza UNA vez por tamaño de foto y se guarda en píxeles
 * crudos. Antes se rasterizaba el SVG en cada foto, y eso costaba 800 ms y 25
 * MB de pico POR FOTO: con cuatro fotos en vuelo era lo que empujaba al
 * servidor a quedarse sin memoria, y una vez que empieza a swapear todo tarda
 * treinta veces más. Las fotos de un evento miden todas lo mismo, así que la
 * primera paga y las otras cuatrocientas no pagan nada.
 */
export async function capaParaFoto(opts: {
  anchoFoto: number;
  altoFoto: number;
  imagen: Buffer | null;
  cfg: ConfigMarca;
  conTexto: boolean;
}): Promise<sharp.OverlayOptions> {
  const { anchoFoto: W, altoFoto: H, cfg } = opts;
  const clave = createHash("sha1")
    .update(opts.imagen ? opts.imagen.subarray(0, 4096) : Buffer.from("logo"))
    .update(`|${opts.imagen?.length ?? 0}|${W}x${H}|${opts.conTexto ? 1 : 0}|`)
    .update(JSON.stringify(cfg))
    .digest("hex");

  const guardada = estado.capas.get(clave);
  if (guardada) return superponer(guardada);

  const unidad = await unidadParaFoto({ anchoFoto: W, imagen: opts.imagen, cfg, conTexto: opts.conTexto });
  const capa = await rasterizarCapa({ anchoFoto: W, altoFoto: H, unidad, cfg });

  if (estado.capas.size >= CAPAS_MAX) {
    // La más vieja primero: Map conserva el orden de inserción.
    const vieja = estado.capas.keys().next().value;
    if (vieja !== undefined) estado.capas.delete(vieja);
  }
  estado.capas.set(clave, capa);

  return superponer(capa);
}

/**
 * La unidad del tamaño que le toca a una foto de este ancho.
 *
 * Es lo único de la marca que depende del servidor —las fuentes del repo, el
 * logo de public/— y por eso es lo que se arma acá y viaja armado a la Lambda
 * de derivados: con la unidad, el patrón y la capa salen iguales en los dos
 * lados.
 */
export async function unidadParaFoto(opts: {
  anchoFoto: number;
  imagen: Buffer | null;
  cfg: ConfigMarca;
  conTexto: boolean;
}): Promise<Unidad> {
  return armarUnidad({
    imagen: opts.imagen,
    cfg: opts.cfg,
    ancho: Math.round(opts.anchoFoto * opts.cfg.escala),
    conTexto: opts.conTexto,
  });
}
