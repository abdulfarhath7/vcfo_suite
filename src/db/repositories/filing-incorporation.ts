import 'server-only';

import { sql, type SQL } from 'drizzle-orm';
import { complianceInstances, engagements } from '@/db/schema';

/**
 * FILINGS ONLY AFTER INCORPORATION — the read-side guard on `compliance_instances`.
 *
 * A company has no statutory filings before it is incorporated. The generator already refuses
 * to create them (`generateComplianceInstances`, the `incorporated` input), and this predicate
 * hides any row written before that rule existed, so a bad row disappears from every screen,
 * count, digest and reminder even before `npm run filings:pre-coi:prod` removes it.
 *
 * It is the SQL twin of `isIncorporated` plus `periodAfterIncorporation`
 * (`src/lib/compliance/`):
 *   - with an incorporation date on the engagement, the filing must fall due on or after that
 *     day and its period must not end before it;
 *   - without one, the engagement must have started at Registration or Compliance (its stage is
 *     not Pre-Incorporation), as such a company was incorporated before the firm met it.
 *
 * It is a correlated subquery over `engagements`, so a query that does not join engagements
 * can still use it. Callers add it beside their own AuthContext scope; it narrows, never widens.
 */
export const filingAfterIncorporation: SQL<boolean> = sql<boolean>`exists (
  select 1 from ${engagements} inc_e
  where inc_e.id = ${complianceInstances.engagementId}
    and case
      when inc_e.incorporation_date is not null then
        ${complianceInstances.dueDate} >= inc_e.incorporation_date
        and (${complianceInstances.periodEnd} is null or ${complianceInstances.periodEnd} >= inc_e.incorporation_date)
      else inc_e.stage <> 'Pre-Incorporation'
    end
)`;
