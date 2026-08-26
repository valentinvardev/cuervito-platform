/**
 * Genera la miniatura de la grilla para las fotos que ya existen.
 *
 * Las fotos nuevas la generan solas al subirse. Ésta es para las 18.000 que
 * ya estaban: mientras no la tengan, la tienda cae al preview de 2400px, que
 * se ve bien pero pesa quince veces más.
 *
 * Se puede cortar y volver a correr cuantas veces haga falta: busca las que
 * todavía no tienen miniatura, así que retomar es simplemente arrancarlo de
 * nuevo. No toca nada más de la foto.
 *
 *   node scripts/rellenar-miniaturas.mjs            todas
 *   node scripts/rellenar-miniaturas.mjs --limite 200
 *
 * En el VPS conviene correrlo con `nohup … &` y mirar el avance, porque son
 * varias horas: cada foto es bajar 845 KB de S3, achicarla y volver a subir.
 */
import fs from "node:fs";
import sharp from "sharp";
import { PrismaClient } from "../generated/prisma/index.js";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const THUMB_WIDTH = 560;
const THUMB_QUALITY = 72;
const CACHE = "public, max-age=86400";
/**
 * Cuántas a la vez.
 *
 * Cada foto es bajar 845 KB, achicarla y subir 56 KB. Lo que tarda es la red,
 * no el procesador: achicar una imagen son milisegundos. Y como el VPS tiene
 * una conexión mala pero la espera es en su mayoría LATENCIA y no ancho de
 * banda, subir el paralelismo escala casi lineal —a 4 daba 12 por minuto, que
 * son veintiuna horas—.
 *
 * Se ajusta sin editar el archivo:  --paralelo 16
 * Si el ritmo deja de mejorar al subirlo, ahí está el techo del enlace.
 */
const iPar = process.argv.indexOf("--paralelo");
const A_LA_VEZ = iPar > -1 ? Math.max(1, Number(process.argv[iPar + 1])) : 12;

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const bucket = env.AWS_S3_BUCKET;
if (!bucket) throw new Error("Falta AWS_S3_BUCKET en .env");

const s3 = new S3Client({
  region: env.AWS_REGION ?? "us-east-1",
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
      : undefined,
});
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

/**
 * Baja el preview POR CLOUDFRONT, no por S3.
 *
 * Son 18.000 fotos de 845 KB: unos 16 GB. Pedidos a S3 eso es
 * DataTransfer-Out, que es exactamente la línea que en su momento hizo que la
 * factura de S3 fuera de $46 y por la que se puso CloudFront delante. Por CF
 * cae dentro del tier gratuito de 1 TB, que hoy está casi sin usar.
 *
 * Se puede porque el preview es la imagen CON marca de agua, la misma que la
 * tienda ya sirve públicamente por esa misma URL. Sin CloudFront configurado
 * cae a S3, que en desarrollo es lo correcto.
 */
async function bajar(key) {
  if (env.CLOUDFRONT_DOMAIN) {
    const r = await fetch(`https://${env.CLOUDFRONT_DOMAIN}/${key}`);
    if (!r.ok) throw new Error(`CloudFront ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const trozos = [];
  for await (const t of r.Body) trozos.push(t);
  return Buffer.concat(trozos);
}

const iLimite = process.argv.indexOf("--limite");
const limite = iLimite > -1 ? Number(process.argv[iLimite + 1]) : Infinity;

// Se pide de a poco y siempre la primera página: como cada vuelta deja de
// cumplir el filtro, la "primera página" siempre trae las que faltan.
const TANDA = 100;
let hechas = 0;
let fallidas = 0;
const arranque = Date.now();

const pendientes = await db.photo.count({
  where: { thumbKey: null, previewKey: { not: null }, deletedAt: null },
});
console.log(`Faltan ${pendientes.toLocaleString("es-AR")} miniaturas.\n`);

while (hechas + fallidas < limite) {
  const fotos = await db.photo.findMany({
    where: { thumbKey: null, previewKey: { not: null }, deletedAt: null },
    take: Math.min(TANDA, limite - hechas - fallidas),
    select: { id: true, ownerId: true, eventId: true, previewKey: true },
  });
  if (fotos.length === 0) break;

  for (let i = 0; i < fotos.length; i += A_LA_VEZ) {
    await Promise.all(
      fotos.slice(i, i + A_LA_VEZ).map(async (f) => {
        try {
          const grande = await bajar(f.previewKey);
          const chica = await sharp(grande)
            .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
            .webp({ quality: THUMB_QUALITY })
            .toBuffer();
          const key = `cuervito/users/${f.ownerId}/events/${f.eventId}/thumb/${f.id}.webp`;
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: chica,
              ContentType: "image/webp",
              CacheControl: CACHE,
            }),
          );
          await db.photo.update({ where: { id: f.id }, data: { thumbKey: key } });
          hechas++;
        } catch (e) {
          // Una foto rota no puede frenar el relleno: se anota y sigue. Como el
          // filtro es "sin miniatura", la próxima corrida la vuelve a intentar.
          fallidas++;
          console.error(`  falló ${f.id}: ${e?.message ?? e}`);
        }
      }),
    );
  }

  const min = (Date.now() - arranque) / 60000;
  const ritmo = hechas / Math.max(min, 0.01);
  console.log(
    `${hechas.toLocaleString("es-AR")} hechas · ${fallidas} fallidas · ` +
      `${Math.round(ritmo)}/min · faltan ~${Math.round((pendientes - hechas) / Math.max(ritmo, 1))} min`,
  );
}

console.log(`\nListo. ${hechas.toLocaleString("es-AR")} miniaturas, ${fallidas} fallidas.`);
await db.$disconnect();
