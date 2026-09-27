import sharp from "sharp";

import type { ConfigMarca } from "~/server/marca-agua-config";

/**
 * La capa de marca de agua, sin nada del servidor: ni base, ni archivos, ni
 * "server-only".
 *
 * Vive aparte porque la usan dos lugares que tienen que dar EXACTAMENTE lo
 * mismo: el procesador del VPS y la Lambda que genera los derivados al lado de
 * S3 (lambda-derivados/). Si cada uno tuviera su copia, la primera corrección
 * de la marca que se hiciera en uno solo dejaría fotos marcadas distinto según
 * dónde se procesaron. Lo que depende del servidor —leer la configuración,
 * armar la unidad con las fuentes del repo— sigue en marca-agua.ts.
 */

/** La unidad ya armada: la imagen con su texto, en PNG. */
export type Unidad = { png: Buffer; ancho: number; alto: number };

/**
 * La capa que se apoya sobre la foto: un SVG de su mismo tamaño.
 *
 * En mosaico y diagonal es un <pattern> con la unidad como <image>. En
 * mosaico cada unidad rota adentro de su celda, y las filas van corridas
 * media celda —como ladrillos— para que no queden pasillos vacíos. En
 * diagonal la unidad no rota: rota la trama entera con patternTransform, y
 * el resultado son hileras inclinadas.
 *
 * La opacidad va en un <g> y no en el PNG: así el mismo PNG sirve para
 * cualquier opacidad sin volver a renderizar.
 */
export function capaMarca(opts: {
  anchoFoto: number;
  altoFoto: number;
  unidad: Unidad;
  cfg: ConfigMarca;
}): sharp.OverlayOptions {
  const { anchoFoto: W, altoFoto: H, unidad: u, cfg } = opts;
  const href = `data:image/png;base64,${u.png.toString("base64")}`;
  const n = (x: number) => Math.round(x * 100) / 100;
  const img = (x: number, y: number, rot = 0) =>
    `<image href="${href}" xlink:href="${href}" x="${n(x)}" y="${n(y)}" width="${u.ancho}" height="${u.alto}"` +
    (rot ? ` transform="rotate(${rot} ${n(x + u.ancho / 2)} ${n(y + u.alto / 2)})"` : "") +
    ` />`;

  let cuerpo: string;
  let defs = "";
  const aire = u.ancho * cfg.separacion;

  if (cfg.patron === "mosaico") {
    // La celda envuelve a la unidad ya rotada, más el aire.
    const rad = (cfg.rotacion * Math.PI) / 180;
    const bw = Math.abs(u.ancho * Math.cos(rad)) + Math.abs(u.alto * Math.sin(rad));
    const bh = Math.abs(u.ancho * Math.sin(rad)) + Math.abs(u.alto * Math.cos(rad));
    const cw = Math.ceil(bw + aire);
    const ch = Math.ceil(bh + aire);
    const x = (cw - u.ancho) / 2;
    const y = (ch - u.alto) / 2;
    // Dos filas por celda: la segunda corrida medio paso, y su copia del
    // otro lado para que el corte de la celda no deje media unidad afuera.
    defs =
      `<pattern id="p" patternUnits="userSpaceOnUse" width="${cw}" height="${ch * 2}">` +
      img(x, y, cfg.rotacion) +
      img(x + cw / 2, y + ch, cfg.rotacion) +
      img(x - cw / 2, y + ch, cfg.rotacion) +
      `</pattern>`;
    cuerpo = `<rect width="${W}" height="${H}" fill="url(#p)" />`;
  } else if (cfg.patron === "diagonal") {
    const cw = Math.ceil(u.ancho + aire);
    const ch = Math.ceil(u.alto + aire);
    defs =
      `<pattern id="p" patternUnits="userSpaceOnUse" width="${cw}" height="${ch * 2}" patternTransform="rotate(${cfg.rotacion})">` +
      img((cw - u.ancho) / 2, (ch - u.alto) / 2) +
      img((cw - u.ancho) / 2 + cw / 2, (ch - u.alto) / 2 + ch) +
      img((cw - u.ancho) / 2 - cw / 2, (ch - u.alto) / 2 + ch) +
      `</pattern>`;
    // El rect se agranda para que la trama rotada cubra las esquinas.
    const d = Math.ceil(Math.hypot(W, H));
    cuerpo = `<rect x="${n((W - d) / 2)}" y="${n((H - d) / 2)}" width="${d}" height="${d}" fill="url(#p)" />`;
  } else if (cfg.patron === "centro") {
    cuerpo = img((W - u.ancho) / 2, (H - u.alto) / 2, cfg.rotacion);
  } else {
    const m = Math.round(W * cfg.margen);
    cuerpo = img(W - u.ancho - m, H - u.alto - m);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    (defs ? `<defs>${defs}</defs>` : "") +
    `<g opacity="${cfg.opacidad}">${cuerpo}</g></svg>`;

  return { input: Buffer.from(svg), blend: "over" };
}

/** La capa ya rasterizada: píxeles crudos, lista para apoyar sobre la foto. */
export type Capa = { datos: Buffer; ancho: number; alto: number };

/** Rasterizar la capa una vez, a píxeles crudos RGBA. */
export async function rasterizarCapa(opts: {
  anchoFoto: number;
  altoFoto: number;
  unidad: Unidad;
  cfg: ConfigMarca;
}): Promise<Capa> {
  const svg = capaMarca(opts);
  const datos = await sharp(svg.input as Buffer).ensureAlpha().raw().toBuffer();
  return { datos, ancho: opts.anchoFoto, alto: opts.altoFoto };
}

/** La capa rasterizada, como se la pasa a composite(). */
export function superponer(capa: Capa): sharp.OverlayOptions {
  return { input: capa.datos, raw: { width: capa.ancho, height: capa.alto, channels: 4 }, blend: "over" };
}
