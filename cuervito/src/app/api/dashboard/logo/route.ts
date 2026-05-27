import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { createCFInvalidation, deleteS3Objects, putS3Object, storefrontLogoKey } from "~/server/s3";

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: "Solo PNG, JPG o WebP." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Máximo 3 MB." }, { status: 413 });

  const key = storefrontLogoKey(session.user.id);
  await putS3Object(key, Buffer.from(await file.arrayBuffer()), file.type);
  await db.user.update({
    where: { id: session.user.id },
    data: { logoKey: key },
  });

  void createCFInvalidation([`/${key}`]);
  return NextResponse.json({ ok: true, key });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = storefrontLogoKey(session.user.id);
  await deleteS3Objects([key]).catch(() => undefined);
  await db.user.update({
    where: { id: session.user.id },
    data: { logoKey: null },
  });

  return NextResponse.json({ ok: true });
}
