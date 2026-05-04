import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role) for Storage uploads.
 * Never import this in client components.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set — admin client unavailable");
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getInterviewsBucket(): string {
  return process.env.SUPABASE_INTERVIEWS_BUCKET || "interviews";
}
