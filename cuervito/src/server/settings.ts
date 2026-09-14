import "server-only";

import { unstable_cache } from "next/cache";

import { env } from "~/env";
import { db } from "~/server/db";

const TEST_MODE_KEY = "mp_test_mode";

/**
 * Reads mp_test_mode from the Setting table, falling back to env.MP_TEST_MODE
 * if not configured. Cached 5s to avoid hammering Supabase from every
 * checkout request — the toggle is admin-only and rarely changes.
 */
async function readMpTestMode(): Promise<boolean> {
  const row = await db.setting.findUnique({
    where: { key: TEST_MODE_KEY },
    select: { value: true },
  });
  if (!row) return env.MP_TEST_MODE;
  return row.value === "true";
}

export const getMpTestMode = unstable_cache(
  readMpTestMode,
  ["setting", TEST_MODE_KEY],
  { revalidate: 5, tags: [`setting:${TEST_MODE_KEY}`] },
);

/**
 * Una bandera cualquiera de Setting, leída con caché y escrita con upsert.
 *
 * getMpTestMode era la única y estaba escrita a mano. Con los interruptores de
 * los correos y el de historias iban a ser cinco copias del mismo par de
 * funciones, y cinco copias es exactamente cómo una termina sin el
 * revalidateTag y muestra el valor viejo durante cinco segundos.
 */
export function leerBandera(key: string, porDefecto = false): Promise<boolean> {
  return unstable_cache(
    async () => {
      const fila = await db.setting.findUnique({ where: { key }, select: { value: true } });
      return fila ? fila.value === "true" : porDefecto;
    },
    ["setting", key],
    { revalidate: 5, tags: [`setting:${key}`] },
  )();
}

export async function escribirBandera(key: string, valor: boolean): Promise<void> {
  const value = valor ? "true" : "false";
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Historias abierta a todas las cuentas activas, sin lista ni invitación. */
export const HISTORIAS_ABIERTA = "historias_abierta";

export async function setMpTestMode(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  await db.setting.upsert({
    where: { key: TEST_MODE_KEY },
    update: { value },
    create: { key: TEST_MODE_KEY, value },
  });
}
