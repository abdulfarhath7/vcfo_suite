import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { assistCatalogBody } from '@/lib/assist-agents/catalog-body';

/**
 * GET /api/assist/catalog — the agents and their tasks (flat, `agents`, as older extensions read
 * it) and the same as a tree of any depth (`tree`), each task with its recipe version, plus each
 * portal pack's legal status and live switch (`packs`). Staff only.
 *
 * The extension reads it at every run start, so it also carries the remote kill switch
 * (`extensionDisabled`, `minExtensionVersion`; SAFETY.md G18) and the firm's own contact details
 * (`firmContacts`), which the no-placeholder guard (G16) never types into a client's field. The
 * body is built by `assistCatalogBody`, which the live browser's session start also uses.
 */
export async function GET() {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  return json(await assistCatalogBody(guard.ctx));
}
