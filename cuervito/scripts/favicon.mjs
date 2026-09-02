/**
 * Genera el juego de favicons a partir del isotipo de encontrate.
 *
 *   node scripts/favicon.mjs
 *
 * Dos decisiones que se ven al mirar el resultado y no al leer el código:
 *
 * BALDOSA DE TINTA, no la silueta suelta. El isotipo es blanco sobre
 * transparente; a 16px una silueta sin fondo desaparece contra la barra del
 * navegador, que es clara en un tema y oscura en el otro. El favicon es
 * justamente el lugar donde uno no elige el fondo.
 *
 * ESCALA ÓPTICA. La marca ocupa más proporción cuanto más chico es el ícono.
 * Con el mismo 62% en todas, a 16px el pájaro se convertía en una mancha:
 * comparado lado a lado, 92% se lee y 62% no. A 180px, en cambio, el 62% deja
 * el aire que un ícono de aplicación necesita.
 */
import fs from "node:fs";
import sharp from "sharp";

const TINTA = "#12110F";
const ISO = "public/marca/isotipo.png";

/** Cuánto del alto ocupa la marca, según el tamaño. */
const PROPORCION = { 16: 0.92, 32: 0.8, 48: 0.72, 180: 0.62, 512: 0.62 };

const png = {};
for (const [n, prop] of Object.entries(PROPORCION).map(([k, v]) => [Number(k), v])) {
  const marca = await sharp(ISO)
    .resize({ height: Math.round(n * prop), fit: "inside", kernel: "lanczos3" })
    .toBuffer();
  png[n] = await sharp({ create: { width: n, height: n, channels: 4, background: TINTA } })
    .composite([{ input: marca, gravity: "center" }])
    .png()
    .toBuffer();
}

fs.writeFileSync("public/favicon-16x16.png", png[16]);
fs.writeFileSync("public/favicon-32x32.png", png[32]);
fs.writeFileSync("public/apple-touch-icon.png", png[180]);

/* El .ico se arma a mano: sharp no lo escribe, y desde Vista un ICO puede
   llevar los PNG adentro tal cual. Son 6 bytes de cabecera, 16 por imagen, y
   los datos pegados atrás. */
const dentro = [16, 32, 48].map((n) => ({ n, buf: png[n] }));
const cab = Buffer.alloc(6 + 16 * dentro.length);
cab.writeUInt16LE(0, 0);
cab.writeUInt16LE(1, 2);
cab.writeUInt16LE(dentro.length, 4);
let off = cab.length;
dentro.forEach((ic, i) => {
  const o = 6 + i * 16;
  cab.writeUInt8(ic.n, o);
  cab.writeUInt8(ic.n, o + 1);
  cab.writeUInt16LE(1, o + 4);
  cab.writeUInt16LE(32, o + 6);
  cab.writeUInt32LE(ic.buf.length, o + 8);
  cab.writeUInt32LE(off, o + 12);
  off += ic.buf.length;
});
fs.writeFileSync("public/favicon.ico", Buffer.concat([cab, ...dentro.map((i) => i.buf)]));

for (const f of ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png"])
  console.log(`  ${f.padEnd(22)} ${fs.statSync("public/" + f).size} bytes`);
