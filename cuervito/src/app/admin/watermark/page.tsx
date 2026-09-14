import { db } from "~/server/db";
import { leerConfigMarca } from "~/server/marca-agua";
import { resolveMediaUrl } from "~/server/media";

import { Editor } from "./_editor";
import { Fotografos } from "./_fotografos";

export const dynamic = "force-dynamic";

// Cuántas fotos de muestra, y de cuántos fotógrafos distintos. Son las vistas
// previas sin marca, que pesan; alcanza con una docena para ver la marca
// sobre fondos claros, oscuros, verticales y apaisados.
const MUESTRA = 12;
const POR_FOTOGRAFO = 3;

/**
 * La marca de agua de la plataforma.
 *
 * Arriba, el editor: la unidad (imagen, texto, color) y el patrón (cómo se
 * reparte), con la marca probada en vivo sobre fotos reales de los fotógrafos.
 * Abajo, lo que ya existía: regenerar lo procesado y la marca propia de cada
 * fotógrafo.
 */
export default async function AdminWatermarkPage() {
  const [cfg, setting, candidatas, fotografos, totalFotos, sinPreview] = await Promise.all([
    leerConfigMarca(),
    db.setting.findUnique({ where: { key: "watermark" } }),
    db.photo.findMany({
      where: { deletedAt: null, previewCleanKey: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true,
        ownerId: true,
        previewCleanKey: true,
        width: true,
        height: true,
        event: { select: { name: true } },
        owner: { select: { name: true, email: true } },
      },
    }),
    db.user.findMany({
      where: { role: "PHOTOGRAPHER", status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        watermarkKey: true,
        _count: { select: { photosOwned: { where: { fileSize: { not: null }, deletedAt: null } } } },
      },
    }),
    db.photo.count({ where: { fileSize: { not: null }, deletedAt: null } }),
    db.photo.count({
      where: {
        fileSize: { not: null },
        deletedAt: null,
        OR: [{ previewKey: null }, { previewCleanKey: null }, { previewGeneratedAt: null }],
      },
    }),
  ]);

  // Variedad: hasta tres por fotógrafo, para que la muestra no sea el último
  // evento entero de una sola persona.
  const porDueno = new Map<string, number>();
  const muestra = [];
  for (const f of candidatas) {
    const n = porDueno.get(f.ownerId) ?? 0;
    if (n >= POR_FOTOGRAFO) continue;
    porDueno.set(f.ownerId, n + 1);
    muestra.push(f);
    if (muestra.length >= MUESTRA) break;
  }

  const fotos = await Promise.all(
    muestra.map(async (f) => ({
      id: f.id,
      url: await resolveMediaUrl(f.previewCleanKey!),
      evento: f.event?.name ?? "",
      fotografo: f.owner?.name ?? f.owner?.email ?? "",
      vertical: (f.height ?? 0) > (f.width ?? 0),
    })),
  );

  const pngUrl = setting?.value ? await resolveMediaUrl(setting.value) : null;

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Marca de agua</h1>
            <p>
              Lo que se estampa sobre cada foto de la tienda. Los cambios valen para lo que se
              procese de acá en más; lo ya procesado se regenera más abajo.
            </p>
          </div>
        </div>

        <Editor inicial={cfg} pngUrl={pngUrl} fotos={fotos} />

        <Fotografos
          totalFotos={totalFotos}
          sinPreview={sinPreview}
          fotografos={fotografos.map((p) => ({
            id: p.id,
            nombre: p.name ?? p.email ?? p.id,
            propia: !!p.watermarkKey,
            fotos: p._count.photosOwned,
          }))}
        />
      </div>
    </main>
  );
}
