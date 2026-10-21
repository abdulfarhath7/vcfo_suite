import { signOut as authJsSignOut } from 'next-auth/react';

/** JSON fetch for the app's own API routes; a 401 signs the stale session out. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    // Stale JWT after reseed/delete — clear cookie and bounce to login.
    void authJsSignOut({ callbackUrl: '/login' });
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
