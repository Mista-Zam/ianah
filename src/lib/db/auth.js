import { supabase, isConfigured, unwrap } from "../supabase.js";

/**
 * All authorisation lives in Postgres: `profiles.role` decides everything and the
 * publishable key cannot see it. So after signing in we read our own profile row
 * to learn whether we are an admin — we never trust anything the client sent.
 */

export async function getSession() {
  if (!isConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/**
 * Read the signed-in user's own profile row.
 *
 * The `.eq("id", ...)` filter is load-bearing, not tidiness. `profiles_select_own`
 * is `id = auth.uid() or is_admin()`, so an administrator can legitimately read
 * EVERY profile. Without the filter an admin's query returns one row per user and
 * `maybeSingle()` fails with PGRST116 "The result contains N rows" -- which the
 * error branch below would swallow into `null`, leaving isAdmin permanently false
 * and locking real admins out of the console while students worked fine.
 * Verified against a live admin session before this filter was added.
 */
export async function getCurrentProfile(userId = null) {
  if (!isConfigured) return null;

  let id = userId;
  if (!id) {
    const { data } = await supabase.auth.getSession();
    id = data.session?.user?.id ?? null;
  }
  if (!id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at")
    .eq("id", id)
    .maybeSingle();

  // The profile row is created by an AFTER INSERT trigger on auth.users. If the
  // read races that trigger, treat it as "not an admin yet" rather than crashing.
  if (error) return null;
  return data ?? null;
}

export async function signInWithPassword(email, password) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const result = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (result.error) throw new Error(authMessage(result.error.message, "sign in"));
  return result.data;
}

/**
 * Register a student. `display_name` travels as signup metadata purely so the
 * trigger can seed the profile — handle_new_user discards any `role` in it.
 */
export async function signUpWithPassword({ email, password, displayName }) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const result = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName?.trim() || null },
      emailRedirectTo: window.location.origin,
    },
  });
  if (result.error) throw new Error(authMessage(result.error.message, "sign up"));
  return result.data;
}

export async function sendPasswordReset(email) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/admin/login`,
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  if (!isConfigured) return;
  unwrap(await supabase.auth.signOut(), "Could not sign out");
}

export async function updateDisplayName(displayName) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName?.trim() || null })
    .select("id, role, display_name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** Replace Supabase's terse auth errors with something actionable. */
function authMessage(message = "", action) {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "That email and password combination wasn't recognised.";
  }
  if (text.includes("email not confirmed")) {
    return "Check your inbox to confirm your email address first.";
  }
  if (text.includes("user already registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (text.includes("password should be")) return "Choose a longer password.";
  if (text.includes("rate limit")) return "Too many attempts. Please wait a moment.";
  return message || `Could not ${action}. Please try again.`;
}

export { authMessage };