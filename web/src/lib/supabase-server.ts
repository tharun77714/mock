import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role) for Storage uploads.
 * Never import this in client components.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getInterviewsBucket(): string {
  return process.env.SUPABASE_INTERVIEWS_BUCKET || "interviews";
}
