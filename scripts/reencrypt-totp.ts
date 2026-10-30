/**
 * M7 one-time move of every stored two-step (TOTP) secret from the AUTH_SECRET key (`t1`)
 * to the CREDENTIALS_ENCRYPTION_KEY key (`t2`). After it, rotating AUTH_SECRET no longer
 * touches two-step sign-in. It uses the profiles repository only.
 *
 *   npm run totp:reencrypt -- --dry-run     # count only, write nothing
 *   npm run totp:reencrypt                  # move the rows
 *
 * It needs CREDENTIALS_ENCRYPTION_KEY and the AUTH_SECRET that sealed the rows (set
 * AUTH_SECRET_PREVIOUS too when a rotation is under way). It is safe to run again: rows
 * already on `t2` are left alone.
 *
 * PRODUCTION: RDS is private. Run this from inside the VPC (the SSM session on the NAT
 * instance or another host in the VPC, see docs/context/AWS-DEPLOY.md), with DB_SECRET_ARN,
 * DB_HOST, DB_PORT, DB_NAME, DB_USER and NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem.
 * Never open RDS to the internet for it. Values are never printed; profile ids only.
 */
import './load-env';
import { systemReencryptTotpSecrets } from '../src/db/repositories/profiles';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set. Set it first; there is no key to move the secrets to.');
  }
  const r = await systemReencryptTotpSecrets({ dryRun });
  console.log(`${dryRun ? 'dry run: ' : ''}checked=${r.checked} moved=${r.moved} current=${r.current} unreadable=${r.unreadable.length} skipped=${r.skipped}`);
  for (const id of r.unreadable) console.log(`  unreadable: profile ${id} (reset their two-step sign-in)`);
  if (r.skipped) console.log('  some rows changed during the run; run the script again');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
