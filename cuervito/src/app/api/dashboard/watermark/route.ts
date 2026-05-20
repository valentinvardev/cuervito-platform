import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { deleteS3Objects, putS3Object, userWatermarkKey } from "~/server/s3";
import { invalidateUserWatermarkCache } from "~/server/watermark";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("watermark");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  if (file.type !== "image/png")
    return NextResponse.json({ error: "Solo PNG transparente." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Máximo 2 MB." }, { status: 413 });

  const key = userWatermarkKey(session.user.id);
  await putS3Object(key, Buffer.from(await file.arrayBuffer()), "image/png");
  await db.user.update({
    where: { id: session.user.id },
    data: { watermarkKey: key },
  });
  invalidateUserWatermarkCache(session.user.id);

  return NextResponse.json({ ok: true, key });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = userWatermarkKey(session.user.id);
  await deleteS3Objects([key]).catch(() => undefined);
  await db.user.update({
    where: { id: session.user.id },
    data: { watermarkKey: null },
  });
  invalidateUserWatermarkCache(session.user.id);

  return NextResponse.json({ ok: true });
}
