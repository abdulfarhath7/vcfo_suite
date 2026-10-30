/**
 * One-off / manual run of the compliance generator against the database that
 * src/db/client.ts connects to. Same code path as the Inngest cron
 * (`src/jobs/compliance-generate.ts`), minus the WhatsApp nudges.
 *
 *   npm run compliance:generate
 *
 * Locally that is DATABASE_URL. Against RDS (private, no DATABASE_URL): open the
 * SSM tunnel on the NAT instance, set the DB_* vars that `node scripts/db-env-prod.mjs`
 * prints, and NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem (docs/context/AWS-DEPLOY.md).
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
