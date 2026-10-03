import { supabase, isConfigured } from "../supabase.js";

/**
 * Moderator account management.
 *
 * Both calls are SECURITY DEFINER functions (supabase/migrations/0011_moderator_accounts.sql)
 * that check `is_admin()` server-side. Nothing here is trusted by the database: the
 * browser could skip every check in this file and still be refused. The client-side
 * validation is only there to avoid pointless round trips.
 *
 * Creating an auth user requires GoTrue's admin API, which the publishable key
 * cannot reach. Shipping `service_role` to make this work from the browser is not
 * an option, hence the RPC.
 */

/** Every moderator account, oldest first. */
export async function fetchModerators() {
  if (!isConfigured) return [];

  const { data, error } = await supabase.rpc("admin_list_moderators");
  if (error) throw new Error(friendlyModeratorError(error.message));

  return data ?? [];
}

/**
 * Create a moderator and sign them straight in — the account arrives already
 * confirmed, since there is no mailbox to confirm against. Returns the new user id.
 */
export async function createModerator({ email, password, displayName = null }) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_create_moderator", {
    p_email: email.trim().toLowerCase(),
    p_password: password,
    p_display_name: displayName?.trim() || null,
  });

  if (error) throw new Error(friendlyModeratorError(error.message));
  return data ?? null;
}

/**
 * The database raises plain-language exceptions already, but PostgREST appends
 * the SQLSTATE and details, which would surface in the UI as something like
 * "Use a password of at least 10 characters.\nCode: 22023". Keep the first line.
 */
function friendlyModeratorError(message = "") {
  const text = message.trim();
  if (!text) return "Could not complete that. Please try again.";

  const firstLine = text.split("\n")[0].trim();
  const lower = firstLine.toLowerCase();

  // auth.uid() was null or the caller is not a moderator. Either their role
  // changed or their session expired between page load and submit.
  if (lower.includes("only moderators")) {
    return "Your account is no longer able to do that. Sign in again and retry.";
  }
  if (lower.includes("password of at least")) {
    return "Use a password of at least 10 characters.";
  }
  if (lower.includes("already exists")) {
    return "An account with that email already exists.";
  }
  if (lower.includes("valid email")) return "Enter a valid email address.";
  if (lower.includes("choose a password")) return "Choose a password.";
  if (lower.includes("reserved demo address")) {
    return "That is a reserved demo address. Use a real email.";
  }

  return firstLine;
}