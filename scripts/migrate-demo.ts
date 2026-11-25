/**
 * npm run db:migrate-demo — create the demo database if it is missing and apply every migration
 * to it (PLAN H2, docs/context/notes/demo-data.md "Demo logins"). Run it on every deploy that
 * adds a migration, after `npm run db:migrate` on the main database. Production goes through
 * the SSM tunnel: `npm run db:migrate-demo:prod`.
 */
import './load-env';

import { ensureDemoDatabase, migrateDemoDatabase } from './demo-db';

async function main() {
  await ensureDemoDatabase();
  await migrateDemoDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
