import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { editorSourceKey, putS3Object } from "~/server/s3";
import { resolveMediaUrl } from "~/server/media";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB raw — gets re-encoded to JPEG
const MAX_DIMENSION = 4000; // longest side after resize

/**
 * Admin editor: upload a source photo for a project. We re-encode to JPEG
 * (sharp) so the canvas always works with a known format, and cap the longest
 * side so the editor stays responsive.
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
  try {
    const pipeline = sharp(raw).rotate();
    const meta = await pipeline.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    const needsResize = longest > MAX_DIMENSION;
    const out = await (needsResize
      ? pipeline.resize({
          width: meta.width === longest ? MAX_DIMENSION : undefined,
          height: meta.height === longest ? MAX_DIMENSION : undefined,
          withoutEnlargement: true,
        })
      : pipeline
    )
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    processed = out.data;
    width = out.info.width;
    height = out.info.height;
  } catch (err) {
    console.error("[editor upload] sharp failed:", err);
    return NextResponse.json(
      { error: "No pudimos procesar la imagen." },
      { status: 400 },
    );
  }

  const key = editorSourceKey(session.user.id, projectId, "jpg");
  try {
    await putS3Object(key, processed, "image/jpeg");
  } catch (err) {
    console.error("[editor upload] s3 put failed:", err);
    return NextResponse.json(
      { error: "No pudimos subir la imagen." },
      { status: 502 },
    );
  }

  // Adopt the photo's aspect as the canvas dimensions so the source fills it.
  await db.editorProject.update({
    where: { id: projectId },
    data: { sourceKey: key, width, height },
  });

  const url = await resolveMediaUrl(key);
  return NextResponse.json({ ok: true, sourceKey: key, url, width, height });
}
