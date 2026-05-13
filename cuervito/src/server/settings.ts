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

export async function setMpTestMode(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  await db.setting.upsert({
    where: { key: TEST_MODE_KEY },
    update: { value },
    create: { key: TEST_MODE_KEY, value },
  });
}
