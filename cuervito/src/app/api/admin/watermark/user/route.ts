import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { deleteS3Objects, putS3Object, userWatermarkKey } from "~/server/s3";
import { invalidateUserWatermarkCache } from "~/server/watermark";

const MAX_BYTES = 2 * 1024 * 1024;

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") return null;
  return session.user.id;
}

// POST /api/admin/watermark/user?userId=xxx  — upload watermark for a user
export async function POST(req: NextRequest) {
  const actorId = await assertAdmin();
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("watermark");
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  if (file.type !== "image/png") return NextResponse.json({ error: "Solo PNG transparente." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Máximo 2 MB." }, { status: 413 });

  const key = userWatermarkKey(userId);
  await putS3Object(key, Buffer.from(await file.arrayBuffer()), "image/png");
  await db.user.update({ where: { id: userId }, data: { watermarkKey: key } });
  invalidateUserWatermarkCache(userId);

  return NextResponse.json({ ok: true, key });
}

// DELETE /api/admin/watermark/user?userId=xxx  — remove user's custom watermark
export async function DELETE(req: NextRequest) {
  const actorId = await assertAdmin();
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  await deleteS3Objects([userWatermarkKey(userId)]).catch(() => undefined);
  await db.user.update({ where: { id: userId }, data: { watermarkKey: null } });
  invalidateUserWatermarkCache(userId);

  return NextResponse.json({ ok: true });
}
