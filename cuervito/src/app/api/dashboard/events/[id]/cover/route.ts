import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { createCFInvalidation, deleteS3Objects, eventCoverKey, putS3Object } from "~/server/s3";

const MAX_COVER_BYTES = 10 * 1024 * 1024; // 10 MB
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await ctx.params;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true, coverUrl: true },
  });
  if (!event || event.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("cover");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }
  if (!EXT_BY_MIME[file.type]) {
    return NextResponse.json(
      { error: "Solo JPG, PNG o WebP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_COVER_BYTES) {
    return NextResponse.json(
      { error: `Máximo ${(MAX_COVER_BYTES / 1024 / 1024).toFixed(0)} MB.` },
      { status: 413 },
    );
  }

  const ext = EXT_BY_MIME[file.type]!;
  const key = eventCoverKey(session.user.id, eventId, ext);
  const buf = Buffer.from(await file.arrayBuffer());
  await putS3Object(key, buf, file.type);

  // Delete previous cover if it had a different extension
  if (event.coverUrl && event.coverUrl !== key) {
    await deleteS3Objects([event.coverUrl]).catch(() => undefined);
  }

  await db.event.update({
    where: { id: eventId },
    data: { coverUrl: key },
  });

  void createCFInvalidation([`/${key}`]);
  return NextResponse.json({ ok: true, key });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: eventId } = await ctx.params;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true, coverUrl: true },
  });
  if (!event || event.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.coverUrl) {
    await deleteS3Objects([event.coverUrl]).catch(() => undefined);
  }
  await db.event.update({ where: { id: eventId }, data: { coverUrl: null } });
  return NextResponse.json({ ok: true });
}
