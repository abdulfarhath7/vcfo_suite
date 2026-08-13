/**
 * Compatibility stub — Supabase auth is gone; Auth.js owns sessions.
 * Callers that still import this get null / false so they take the Auth.js path.
 */
export function createClient(): null {
  return null;
}

export function isSupabaseConfigured(): boolean {
  return false;
}
