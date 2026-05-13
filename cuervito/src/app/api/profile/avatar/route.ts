import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  avatarKey,
  getPresignedDownloadUrl,
  putS3Object,
} from "~/server/s3";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB raw upload — we resize anyway

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!/^image\//.test(file.type)) {
    return NextResponse.json(
      { error: "Solo se aceptan imágenes." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "La imagen es demasiado grande (máx 8 MB)." },
      { status: 413 },
    );
  }

  const raw = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  try {
    processed = await sharp(raw)
      .rotate()
      .resize(256, 256, { fit: "cover", position: "centre" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error("[avatar] sharp failed:", err);
    return NextResponse.json(
      { error: "No pudimos procesar la imagen." },
      { status: 400 },
    );
  }

  const key = avatarKey(session.user.id, "jpg");
  try {
    await putS3Object(key, processed, "image/jpeg");
  } catch (err) {
    console.error("[avatar] s3 upload failed:", err);
    return NextResponse.json(
      { error: "No pudimos subir la imagen." },
      { status: 502 },
    );
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { image: key },
  });

  const previewUrl = await getPresignedDownloadUrl(key, { expiresIn: 60 * 60 });
  return NextResponse.json({ ok: true, previewUrl });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { image: null },
  });
  return NextResponse.json({ ok: true });
}
