import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { deleteS3Objects, platformWatermarkKey, putS3Object } from "~/server/s3";
import { invalidateWatermarkCache } from "~/server/watermark";

const MAX_WATERMARK_BYTES = 2 * 1024 * 1024; // 2 MB

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") return null;
  return session.user.id;
}

export async function POST(req: NextRequest) {
  const actorId = await assertAdmin();
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("watermark");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }
  if (file.type !== "image/png") {
    return NextResponse.json(
      { error: "Solo PNG transparente." },
      { status: 400 },
    );
  }
  if (file.size > MAX_WATERMARK_BYTES) {
    return NextResponse.json(
      { error: `Máximo ${(MAX_WATERMARK_BYTES / 1024 / 1024).toFixed(0)} MB.` },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const key = platformWatermarkKey();
  await putS3Object(key, buf, "image/png");

  await db.setting.upsert({
    where: { key: "watermark" },
    create: { key: "watermark", value: key },
    update: { value: key },
  });
  await db.adminAction.create({
    data: {
      actorId,
      action: "UPDATE_WATERMARK",
      targetType: "Setting",
      targetId: "watermark",
      metadata: { sizeBytes: file.size },
    },
  });

  invalidateWatermarkCache();

  return NextResponse.json({ ok: true, key });
}

export async function DELETE() {
  const actorId = await assertAdmin();
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteS3Objects([platformWatermarkKey()]).catch(() => undefined);
  await db.setting.delete({ where: { key: "watermark" } }).catch(() => undefined);
  await db.adminAction.create({
    data: {
      actorId,
      action: "DELETE_WATERMARK",
      targetType: "Setting",
      targetId: "watermark",
    },
  });
  invalidateWatermarkCache();
  return NextResponse.json({ ok: true });
}
