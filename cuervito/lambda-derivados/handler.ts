import { createHash } from "node:crypto";

import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import {
  hacerDerivados,
  type Derivados,
  type PedidoDerivados,
  type RespuestaDerivados,
} from "../src/server/derivados";
import { rasterizarCapa, superponer, type Capa, type Unidad } from "../src/server/marca-agua-capa";

/**
 * Los derivados de una foto, al lado de S3.
 *
 * La invoca el VPS (src/server/derivados-lambda.ts) con todo resuelto: dónde
 * está el original, dónde van las tres versiones, qué borrar antes, y la marca
 * ya armada. Esta función no toca la base ni decide nada de la cola: baja,
 * procesa con el MISMO código que el VPS (src/server/derivados.ts y
 * marca-agua-capa.ts), sube, y contesta. Lo que salga distinto de lo esperado
 * vuelve como un "no" para que la foto la procese el VPS.
 */

const s3 = new S3Client({});

/* Como en el VPS: libvips no guarda operaciones de una foto para la siguiente,
   que nunca se parecen. */
sharp.cache({ memory: 64, files: 0, items: 50 });

/* La capa rasterizada, por contenedor. Un evento son fotos apaisadas y
   verticales del mismo tamaño: la primera de cada forma paga el rasterizado y
   el resto del lote, mientras el contenedor siga vivo, no paga nada. */
const capas = new Map<string, Capa>();
const CAPAS_MAX = 2;

class Angosta extends Error {}

/* Defensa extra, además del rol de IAM: sólo se lee un original y sólo se
   escriben o borran derivados. */
const ES_ORIGINAL = /\/users\/[^/]+\/events\/[^/]+\/original\/[^/]+$/;
const ES_DERIVADO = /\/users\/[^/]+\/events\/[^/]+\/(preview|preview-clean|thumb)\/[^/]+\.webp$/;

function pedidoValido(p: PedidoDerivados): string | null {
  if (!p || typeof p !== "object") return "pedido vacío";
  if (!p.bucket || !p.original || !p.claves || !p.unidad?.png || !p.cfg) return "faltan campos";
  if (!ES_ORIGINAL.test(p.original)) return "la clave del original no es de un original";
  for (const k of [p.claves.marcada, p.claves.limpia, p.claves.miniatura, ...(p.viejas ?? [])]) {
    if (!ES_DERIVADO.test(k)) return "una clave de derivado no es de un derivado";
  }
  return null;
}

export async function handler(pedido: PedidoDerivados): Promise<RespuestaDerivados> {
  const invalido = pedidoValido(pedido);
  if (invalido) return { ok: false, motivo: "error", mensaje: invalido };

  const etapas: Record<string, number> = {};
  let ultimo = Date.now();
  const marca = (nombre: string) => {
    const ahora = Date.now();
    etapas[nombre] = (etapas[nombre] ?? 0) + (ahora - ultimo);
    ultimo = ahora;
  };

  let original: Buffer;
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: pedido.bucket, Key: pedido.original }));
    if (!r.Body) throw new Error("S3 devolvió el original vacío");
    original = Buffer.from(await r.Body.transformToByteArray());
  } catch (e) {
    return { ok: false, motivo: "error", mensaje: `descarga: ${mensaje(e)}` };
  }
  marca("descarga");

  const r = await derivadosDe(original, pedido, marca);
  if (!r.ok) return r;
  const d = r.derivados;

  try {
    // Como en el VPS: primero se borran las viejas, después se escriben las nuevas.
    if (pedido.viejas.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: pedido.bucket,
          Delete: { Objects: pedido.viejas.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
    marca("borrar-viejas");

    const poner = (Key: string, Body: Buffer) =>
      s3.send(
        new PutObjectCommand({
          Bucket: pedido.bucket,
          Key,
          Body,
          ContentType: "image/webp",
          CacheControl: pedido.cacheControl,
        }),
      );
    await Promise.all([
      poner(pedido.claves.limpia, d.limpia),
      poner(pedido.claves.marcada, d.marcada),
      poner(pedido.claves.miniatura, d.miniatura),
    ]);
    marca("subir");
  } catch (e) {
    return { ok: false, motivo: "error", mensaje: `subida: ${mensaje(e)}` };
  }

  return { ok: true, ancho: d.ancho, alto: d.alto, bytes: original.length, etapas };
}

/**
 * El trabajo de imagen solo, sin S3: los derivados de un original ya bajado.
 * Separado para poder probarlo fuera de AWS (probar.mjs).
 */
export async function derivadosDe(
  original: Buffer,
  pedido: Pick<PedidoDerivados, "anchoEsperado" | "unidad" | "cfg">,
  marca: (nombre: string) => void = () => undefined,
): Promise<{ ok: true; derivados: Derivados } | Extract<RespuestaDerivados, { ok: false }>> {
  const unidad: Unidad = {
    png: Buffer.from(pedido.unidad.png, "base64"),
    ancho: pedido.unidad.ancho,
    alto: pedido.unidad.alto,
  };
  const huella = createHash("sha1").update(pedido.unidad.png).update(JSON.stringify(pedido.cfg)).digest("hex");
  try {
    const derivados = await hacerDerivados(
      original,
      async (ancho, alto) => {
        // La unidad viene armada para este ancho; para otro no sirve.
        if (ancho !== pedido.anchoEsperado) throw new Angosta();
        const clave = `${huella}|${ancho}x${alto}`;
        let capa = capas.get(clave);
        if (!capa) {
          capa = await rasterizarCapa({ anchoFoto: ancho, altoFoto: alto, unidad, cfg: pedido.cfg });
          if (capas.size >= CAPAS_MAX) {
            const vieja = capas.keys().next().value;
            if (vieja !== undefined) capas.delete(vieja);
          }
          capas.set(clave, capa);
        }
        return superponer(capa);
      },
      { reloj: { marca } },
    );
    return { ok: true, derivados };
  } catch (e) {
    if (e instanceof Angosta) return { ok: false, motivo: "angosta" };
    // No se pudo abrir o procesar la imagen: el VPS la vuelve a intentar y
    // decide si es permanente.
    return { ok: false, motivo: "imagen", mensaje: mensaje(e) };
  }
}

function mensaje(e: unknown): string {
  return (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 300);
}
