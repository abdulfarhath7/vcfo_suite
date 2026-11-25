import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';

/**
 * Who may touch the integrations hub (docs/specs/integrations/ZOHO.md):
 *  - the firm connection, its organisations, links and jobs: super_admin and admin only;
 *  - a module reading the Zoho org mapped to one client: staff who can reach that engagement
 *    (`assertEngagementAccess`); clients, developers and partners never (no portal connect in Z1).
 */
export class IntegrationAccessError extends Error {
  readonly status = 403;
  constructor(message = 'not permitted') {
    super(message);
    this.name = 'IntegrationAccessError';
  }
}

export function assertFirmIntegrationAdmin(ctx: AuthContext): void {
  if (!isFirmWideAdmin(ctx.role)) throw new IntegrationAccessError();
}

export function assertIntegrationStaff(ctx: AuthContext): void {
  if (ctx.role === 'client' || ctx.role === 'developer' || ctx.role === 'partner') throw new IntegrationAccessError();
}
