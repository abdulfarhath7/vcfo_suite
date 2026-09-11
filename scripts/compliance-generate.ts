/**
 * One-off / manual run of the compliance generator against whatever
 * DATABASE_URL points at. Same code path as the Inngest cron
 * (`src/jobs/compliance-generate.ts`), minus the WhatsApp nudges.
 *
 *   npm run compliance:generate
 *
 * Against RDS: export DATABASE_URL from Secrets Manager first and set
 * NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem (see docs/context/AWS-DEPLOY.md §5).
 */
import './load-env';
import { systemGenerateComplianceInstances } from '../src/db/repositories/compliance';

async function main() {
  const result = await systemGenerateComplianceInstances(new Date());
  console.log(
    `engagements=${result.engagements} generated=${result.generated} upserted=${result.upserted}`,
  );
  for (const row of result.digest) {
    console.log(
      `  ${row.companyName} (${row.engagementId}): upcoming=${row.upcoming} overdue=${row.overdue}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
