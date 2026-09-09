/**
 * Anota las miniaturas que YA están en S3 pero que la base no registró.
 *
 * No es lo mismo que rellenar-miniaturas.mjs, y por eso son dos archivos:
 * aquél GENERA la miniatura para fotos viejas que nunca la tuvieron —baja el
 * original, lo achica, lo sube—, y tarda horas. Éste no genera nada. Las
 * miniaturas de estas fotos existen: se subieron correctamente y después
 * _generatePreview se olvidó de guardar la clave en la fila. Lo único que hay
 * que hacer es escribir el nombre del archivo que ya está ahí.
 *
 * Eso pasó entre el 2026-08-26 y el 2026-09-08: 2.620 fotos con el archivo de
 * 56 KB sentado en el bucket mientras la tienda les servía el preview de
 * 845 KB. Sin error en ningún lado, sin nada roto a la vista; sólo la galería
 * quince veces más pesada de lo que se diseñó.
 *
 * Se verifica con HEAD antes de anotar. Escribir a ciegas una clave cuyo
 * objeto no existe es peor que dejarla nula: la grilla cae al preview cuando
 * thumbKey es null, pero si la clave está y el archivo no, muestra un hueco.
 *
 *   node scripts/reparar-miniaturas.mjs --dry      sólo cuenta, no escribe
 *   node scripts/reparar-miniaturas.mjs            repara
 */
import fs from "node:fs";
import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

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

const SECO = process.argv.includes("--dry");
const A_LA_VEZ = 20;

/* Por el POOLER y no por la conexión directa.
   La directa es modo sesión: son pocas conexiones y veinte updates a la vez la
   agotan con "Can't reach database server". El pooler es exactamente para
   esto. */
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const s3 = new S3Client({
  region: env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const fotos = await db.photo.findMany({
  where: { previewKey: { not: null }, thumbKey: null, deletedAt: null },
  select: { id: true, ownerId: true, eventId: true },
});
console.log(`${fotos.length} fotos con preview y sin miniatura registrada.\n`);

/* Primero se pregunta a S3 por TODAS, después se escribe en bloque.

   La primera versión hacía un update por foto: 2.620 viajes a la base, que
   además es lo que la tumbó. El HEAD sí va de a una porque es a S3 y en
   paralelo, pero la escritura es una sentencia cada mil filas. */
const existen = [];
let faltantes = 0;

for (let i = 0; i < fotos.length; i += A_LA_VEZ) {
  await Promise.all(
    fotos.slice(i, i + A_LA_VEZ).map(async (f) => {
      const key = `cuervito/users/${f.ownerId}/events/${f.eventId}/thumb/${f.id}.webp`;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
        existen.push({ id: f.id, key });
      } catch {
        // No está en S3: ésta necesita rellenar-miniaturas.mjs, no esto.
        faltantes++;
      }
    }),
  );
  if ((i + A_LA_VEZ) % 500 < A_LA_VEZ) {
    console.log(`  verificadas ${Math.min(i + A_LA_VEZ, fotos.length)}/${fotos.length} · ${existen.length} están · ${faltantes} no`);
  }
}

let anotadas = 0;
if (!SECO) {
  const BLOQUE = 1000;
  for (let i = 0; i < existen.length; i += BLOQUE) {
    const t = existen.slice(i, i + BLOQUE);
    /* Una sentencia por bloque, con la clave derivada de las columnas que ya
       están en la fila. Es el mismo nombre determinístico que arma
       thumbPhotoKey() y que acabamos de verificar contra el bucket. */
    anotadas += await db.$executeRawUnsafe(
      `UPDATE "Photo" SET "thumbKey" = 'cuervito/users/' || "ownerId" || '/events/' || "eventId" || '/thumb/' || id || '.webp'
       WHERE id = ANY($1::text[]) AND "thumbKey" IS NULL`,
      t.map((x) => x.id),
    );
    console.log(`  ${anotadas}/${existen.length} anotadas`);
  }
} else {
  anotadas = existen.length;
}

console.log(
  `
${SECO ? "[seco] " : ""}${anotadas} miniaturas ${SECO ? "se anotarían" : "anotadas"}, ` +
    `${faltantes} no están en S3 (ésas van con rellenar-miniaturas.mjs).`,
);
await db.$disconnect();
