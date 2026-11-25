import 'server-only';
import { isDemoScope } from '@/db/demo-scope';

/**
 * True when the current call belongs to a demo login (docs/context/notes/demo-data.md, "Demo
 * logins"), so outbound email and WhatsApp started inside it are written to the log only.
 *
 * Since PLAN H2 this is the demo scope of `src/db/demo-scope.ts`: a request whose session token
 * is a demo one, an Inngest job whose event carried `demo: true`, or a `runInDemo` block (the
 * demo seed). The same answer decides which database the call reads, so a call that reads the
 * demo database never sends a real message.
 */
export async function isDemoRequest(): Promise<boolean> {
  try {
    return await isDemoScope();
  } catch {
    return false;
  }
}
