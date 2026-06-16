import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { extractMetadata } from "~/server/editor-metadata";
import { editorLayerKey, editorSourceKey, putS3Object } from "~/server/s3";
import { resolveMediaUrl } from "~/server/media";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB raw
const MAX_DIMENSION = 4000;

/**
 * Admin editor upload. Two modes selected by the `kind` form field:
 *   - `source` (default): replaces the project's background photo; updates
 *     project.sourceKey / width / height. Output is JPEG.
 *   - `layer`: stores an overlay image for a specific layer (requires
 *     `layerId` form field); preserves transparency as PNG; does not touch
 *     the project's background.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const projectId = form.get("projectId");
  const kindRaw = form.get("kind");
  const layerId = form.get("layerId");
  const kind = kindRaw === "layer" ? "layer" : "source";

  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "Falta projectId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!/^image\//.test(file.type)) {
    return NextResponse.json({ error: "Solo se aceptan imágenes." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `La imagen es demasiado grande (máx ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB).` },
      { status: 413 },
    );
  }
  if (kind === "layer" && (typeof layerId !== "string" || !layerId)) {
    return NextResponse.json({ error: "Falta layerId" }, { status: 400 });
  }

  const project = await db.editorProject.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project || project.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const raw = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  let width: number;
  let height: number;
  let contentType: string;
  let ext: "jpg" | "png";
  try {
    const pipeline = sharp(raw).rotate();
    const meta = await pipeline.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    const needsResize = longest > MAX_DIMENSION;
    const sized = needsResize
      ? pipeline.resize({
          width: meta.width === longest ? MAX_DIMENSION : undefined,
          height: meta.height === longest ? MAX_DIMENSION : undefined,
          withoutEnlargement: true,
        })
      : pipeline;

    if (kind === "layer") {
      // Keep alpha for overlays.
      const out = await sized
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      processed = out.data;
      width = out.info.width;
      height = out.info.height;
      contentType = "image/png";
      ext = "png";
    } else {
      const out = await sized
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      processed = out.data;
      width = out.info.width;
      height = out.info.height;
      contentType = "image/jpeg";
      ext = "jpg";
    }
  } catch (err) {
    console.error("[editor upload] sharp failed:", err);
    return NextResponse.json(
      { error: "No pudimos procesar la imagen." },
      { status: 400 },
    );
  }

  const key =
    kind === "layer"
      ? editorLayerKey(session.user.id, projectId, layerId as string, ext)
      : editorSourceKey(session.user.id, projectId, ext);
  try {
    await putS3Object(key, processed, contentType);
  } catch (err) {
    console.error("[editor upload] s3 put failed:", err);
    return NextResponse.json(
      { error: "No pudimos subir la imagen." },
      { status: 502 },
    );
  }

  if (kind === "source") {
    // Pull EXIF + reverse-geocoded metadata from the original (not the
    // sharp-encoded JPEG, since we may have stripped EXIF on re-encode).
    const metadata = await extractMetadata(raw).catch(() => ({}));

    // Adopt the photo's aspect as the canvas dimensions so it fills it,
    // and persist the metadata for template placeholders to read.
    await db.editorProject.update({
      where: { id: projectId },
      data: {
        sourceKey: key,
        width,
        height,
        metadata: metadata as unknown as object,
      },
    });

    const url = await resolveMediaUrl(key);
    return NextResponse.json({
      ok: true,
      key,
      url,
      width,
      height,
      metadata,
    });
  }

  const url = await resolveMediaUrl(key);
  return NextResponse.json({ ok: true, key, url, width, height });
}
