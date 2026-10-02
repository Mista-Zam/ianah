import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * True when the app is running without usable Supabase credentials, or when the
 * .env still holds the placeholder written by the setup script. The UI uses this
 * to show an honest "not configured" screen instead of firing doomed requests.
 */
export const isConfigured =
  Boolean(url) &&
  Boolean(publishableKey) &&
  publishableKey !== "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

/**
 * The publishable (anon) key is safe to ship in a browser bundle — it grants only
 * what RLS allows. The service_role / secret key must never appear in this repo.
 */
export const supabase = isConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "tfw-auth",
      },
      realtime: { params: { eventsPerSecond: 5 } },
      global: { headers: { "x-application-name": "kindness-wall" } },
    })
  : null;

/**
 * Narrow a PostgREST result down to a thrown Error so callers only need one
 * failure path. Surfaces the human-readable reason when the database raised one
 * (check constraint, RLS violation, etc.) and falls back to the raw message.
 */
export function unwrap({ data, error }, context) {
  if (error) {
    const detail = error.message || "Unknown error";
    throw new Error(context ? `${context}: ${detail}` : detail);
  }
  return data;
}

/** Log a failure to the console in a way that is easy to filter in devtools. */
export function logFailure(scope, error) {
  if (import.meta.env.DEV) {
    console.error(`[supabase:${scope}]`, error);
  }
}