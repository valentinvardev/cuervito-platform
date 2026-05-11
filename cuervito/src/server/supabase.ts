import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "~/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Server-only — has full access, bypasses RLS.
 * Use for Storage uploads, signed URLs, and admin tasks. Never import in
 * client components.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  cached ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
