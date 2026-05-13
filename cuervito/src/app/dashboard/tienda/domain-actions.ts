"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import {
  createCustomHostname,
  deleteCustomHostname,
  getCustomHostname,
  isCfConfigured,
  retryCustomHostname,
} from "~/server/cloudflare";
import { db } from "~/server/db";
import { invalidateDomainMap } from "~/server/domain-map";

export type AddDomainState = {
  error: string | null;
  hostname?: string;
  dnsRecords?: { type: string; name: string; value: string }[];
};

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4)
  .max(253)
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+(?<!-)$/,
    "Ingresá un dominio válido (ej: tu-marca.com).",
  )
  // Refuse our own domain so users don't accidentally try to add cuervito.app
  .refine(
    (h) => !h.endsWith("cuervito.app"),
    "Ese dominio ya es nuestro — no podés conectarlo como propio.",
  );

export async function addCustomDomainAction(
  _prev: AddDomainState,
  formData: FormData,
): Promise<AddDomainState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };

  if (!isCfConfigured()) {
    return {
      error:
        "La conexión de dominios no está habilitada en este servidor. Contactanos.",
    };
  }

  const parsed = hostnameSchema.safeParse(formData.get("hostname"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dominio inválido." };
  }
  const hostname = parsed.data;

  // Already taken by anyone (including this user — re-adding requires removing
  // first so we keep one row per hostname).
  const existing = await db.customDomain.findUnique({
    where: { hostname },
    select: { id: true, userId: true },
  });
  if (existing) {
    if (existing.userId === session.user.id) {
      return { error: "Ya agregaste ese dominio. Refrescá para ver su estado." };
    }
    return { error: "Ese dominio ya está conectado a otra cuenta." };
  }

  let cfHostname;
  try {
    cfHostname = await createCustomHostname(hostname);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Cloudflare rechazó el dominio: ${err.message}`
          : "No pudimos registrar el dominio en Cloudflare.",
    };
  }

  await db.customDomain.create({
    data: {
      userId: session.user.id,
      hostname,
      cfHostnameId: cfHostname.id,
      status: "PENDING_DNS",
    },
  });

  invalidateDomainMap();
  revalidatePath("/dashboard/tienda");

  // Surface the DNS records Cloudflare expects, so the UI can show them.
  const dnsRecords: { type: string; name: string; value: string }[] = [];

  // Ownership verification (one of these depending on the SSL method)
  if (cfHostname.ownership_verification?.name && cfHostname.ownership_verification.value) {
    dnsRecords.push({
      type: cfHostname.ownership_verification.type ?? "TXT",
      name: cfHostname.ownership_verification.name,
      value: cfHostname.ownership_verification.value,
    });
  }

  // The CNAME that actually points the domain at us
  dnsRecords.push({
    type: "CNAME",
    name: hostname,
    value: "cuervito.app",
  });

  return { error: null, hostname, dnsRecords };
}

export async function refreshDomainStatusAction(
  domainId: string,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };

  const row = await db.customDomain.findUnique({
    where: { id: domainId },
    select: { id: true, userId: true, cfHostnameId: true },
  });
  if (!row || row.userId !== session.user.id) {
    return { error: "Dominio no encontrado." };
  }
  if (!row.cfHostnameId) return { error: "Dominio no está sincronizado." };

  try {
    const cf = await getCustomHostname(row.cfHostnameId);
    const newStatus =
      cf.status === "active"
        ? "ACTIVE"
        : cf.ssl?.status === "active"
          ? "PENDING_DNS"
          : cf.status === "pending"
            ? "PENDING_SSL"
            : cf.status;

    await db.customDomain.update({
      where: { id: row.id },
      data: {
        status: newStatus,
        verifiedAt: newStatus === "ACTIVE" ? new Date() : undefined,
        errorMessage: cf.verification_errors?.join("; ") ?? null,
      },
    });

    if (newStatus === "ACTIVE") invalidateDomainMap();
    revalidatePath("/dashboard/tienda");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No pudimos actualizar el estado.",
    };
  }
}

export async function removeCustomDomainAction(
  domainId: string,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };

  const row = await db.customDomain.findUnique({
    where: { id: domainId },
    select: { id: true, userId: true, cfHostnameId: true },
  });
  if (!row || row.userId !== session.user.id) {
    return { error: "Dominio no encontrado." };
  }

  if (row.cfHostnameId) {
    try {
      await deleteCustomHostname(row.cfHostnameId);
    } catch (err) {
      console.warn("[domain remove] cloudflare delete failed:", err);
      // Continue — we still remove our row so the user isn't stuck.
    }
  }

  await db.customDomain.delete({ where: { id: row.id } });
  invalidateDomainMap();
  revalidatePath("/dashboard/tienda");
  return { error: null };
}

export async function retryDomainAction(
  domainId: string,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };

  const row = await db.customDomain.findUnique({
    where: { id: domainId },
    select: { id: true, userId: true, cfHostnameId: true },
  });
  if (!row || row.userId !== session.user.id) {
    return { error: "Dominio no encontrado." };
  }
  if (!row.cfHostnameId) return { error: "Dominio no está sincronizado." };

  try {
    await retryCustomHostname(row.cfHostnameId);
    revalidatePath("/dashboard/tienda");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No pudimos reintentar la verificación.",
    };
  }
}
