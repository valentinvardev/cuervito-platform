// Prueba el bundle ya armado (build/handler.js) sin AWS: una foto sintética de
// 24 MP, una unidad de marca, y los derivados. Compara con lo que da el mismo
// código usado como lo usa el VPS, byte a byte.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

import sharp from "sharp";

const require = createRequire(import.meta.url);
const { derivadosDe } = require("./build/handler.js");

const cfg = {
  fuente: "logo",
  patron: "diagonal",
  escala: 0.45,
  opacidad: 0.65,
  rotacion: -30,
  separacion: 0.15,
  margen: 0.04,
  texto: "PRUEBA",
  textoEscala: 0.05,
  color: "blanco",
};

// Una "foto": ruido de 6000x4000 en JPEG, que es lo que pesa y cuesta de verdad.
async function foto(ancho, alto) {
  const ruido = Buffer.alloc(ancho * alto * 3);
  for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 2654435761) >>> 24;
  return sharp(ruido, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

// Una unidad: un rectángulo semitransparente, del ancho que le toca a 2400 px.
const anchoUnidad = Math.round(2400 * cfg.escala);
const unidadPng = await sharp({
  create: { width: anchoUnidad, height: Math.round(anchoUnidad / 3), channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.8 } },
})
  .png()
  .toBuffer();
const pedido = { anchoEsperado: 2400, unidad: { png: unidadPng.toString("base64"), ancho: anchoUnidad, alto: Math.round(anchoUnidad / 3) }, cfg };

const grande = await foto(6000, 4000);
console.log(`original sintético: ${(grande.length / 1048576).toFixed(1)} MB`);

let t = Date.now();
const r = await derivadosDe(grande, pedido);
console.log(`derivados en ${Date.now() - t} ms (con rasterizado de la capa)`);
assert.equal(r.ok, true);
assert.equal(r.derivados.ancho, 2400);
assert.equal(r.derivados.alto, 1600);
for (const k of ["marcada", "limpia", "miniatura"]) {
  const m = await sharp(r.derivados[k]).metadata();
  assert.equal(m.format, "webp", k);
}
assert.equal((await sharp(r.derivados.miniatura).metadata()).width, 560);

t = Date.now();
const r2 = await derivadosDe(grande, pedido);
console.log(`segunda foto del mismo tamaño en ${Date.now() - t} ms (capa en caché)`);
assert.equal(r2.ok, true);
assert.ok(r2.derivados.marcada.equals(r.derivados.marcada), "la misma foto tiene que dar los mismos bytes");

// Lo mismo, armado con el núcleo directamente, como lo arma el VPS.
const { hacerDerivados } = require("./build/nucleo.js");
const { rasterizarCapa, superponer } = require("./build/nucleo.js");
const unidad = { png: unidadPng, ancho: pedido.unidad.ancho, alto: pedido.unidad.alto };
const vps = await hacerDerivados(grande, async (ancho, alto) =>
  superponer(await rasterizarCapa({ anchoFoto: ancho, altoFoto: alto, unidad, cfg })),
);
assert.ok(vps.marcada.equals(r.derivados.marcada), "la marcada tiene que ser idéntica a la del VPS");
assert.ok(vps.limpia.equals(r.derivados.limpia), "la limpia tiene que ser idéntica a la del VPS");
assert.ok(vps.miniatura.equals(r.derivados.miniatura), "la miniatura tiene que ser idéntica a la del VPS");
console.log("idéntico al núcleo compartido, byte a byte");

const angosta = await derivadosDe(await foto(1600, 1067), pedido);
assert.deepEqual(angosta, { ok: false, motivo: "angosta" });
console.log("una foto de 1600 px vuelve como 'angosta'");

const rota = await derivadosDe(Buffer.from("esto no es una imagen"), pedido);
assert.equal(rota.ok, false);
assert.equal(rota.motivo, "imagen");
console.log("una imagen rota vuelve como 'imagen'");

console.log("TODO BIEN");
