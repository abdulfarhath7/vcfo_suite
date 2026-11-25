import 'server-only';
import { headers } from 'next/headers';

/**
 * Marks the current request as made by a demo login (docs/context/notes/demo-data.md, "Demo
 * logins"), so outbound email and WhatsApp started inside it are written to the log only.
 *
 * Next.js keeps one headers object per request and `headers()` returns the same one every time,
 * so a WeakSet of it is a per-request flag that needs no change to the route handlers. Outside a
 * request (an Inngest job, a script, a test) `headers()` throws and the request is not a demo one;
 * those sends are still caught by the demo mailbox rule (`isDemoEmail`).
 */
const demoRequests = new WeakSet<object>();

export async function markDemoRequest(): Promise<void> {
  try {
    demoRequests.add(await headers());
  } catch {
    /* not inside a request */
  }
}

export async function isDemoRequest(): Promise<boolean> {
  try {
    return demoRequests.has(await headers());
  } catch {
    return false;
  }
}
