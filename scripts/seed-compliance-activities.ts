/**
 * Seed the compliance activity master (43 rows, src/data/compliance-activities.ts) and link the
 * register's obligations to their activity. Idempotent: rows that exist are left as they are,
 * so an admin's edits survive a re-run. The app also runs this on first use
 * (`systemEnsureActivitiesSeeded`), so the script is for a fresh database or RDS.
 *
 *   node --conditions=react-server --import tsx scripts/seed-compliance-activities.ts
 *   node --conditions=react-server --import tsx scripts/seed-compliance-activities.ts --sql > out.sql
 *
 * `--sql` prints the same seed as SQL (INSERT … ON CONFLICT DO NOTHING plus the obligation
 * links) without touching any database, for a migration-time seed.
 */
import './load-env';
import { ACTIVITY_SEED, OBLIGATION_ACTIVITY } from '../src/data/compliance-activities';

const q = (v: string | number | null | undefined) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

function sql(): string {
  const cols = 'id, name, kind, activity_group, frequency, module, area, due_rule, penalty, applies, owner_role, reviewer_role, notify_days, visibility, note, confirm, source, sort';
  const rows = ACTIVITY_SEED.map(
    (a, i) =>
      `(${[a.id, a.name, a.kind, a.group, a.frequency, a.module, a.area, a.dueRule, a.penalty, a.applies, a.ownerRole, a.reviewerRole, a.notifyDays, a.visibility, a.note, a.confirm ?? null, a.from, i + 1]
        .map(q)
        .join(', ')})`,
  );
  const links = Object.entries(OBLIGATION_ACTIVITY).map(
    ([o, a]) => `UPDATE "compliance_obligations" SET "activity_id" = ${q(a)} WHERE "id" = ${q(o)} AND "activity_id" IS NULL;`,
  );
  return [`INSERT INTO "compliance_activities" (${cols}) VALUES\n${rows.join(',\n')}\nON CONFLICT ("id") DO NOTHING;`, ...links].join('\n--> statement-breakpoint\n');
}

async function main() {
  if (process.argv.includes('--sql')) {
    console.log(sql());
    return;
  }
  const { systemEnsureActivitiesSeeded } = await import('../src/db/repositories/compliance-activities');
  const result = await systemEnsureActivitiesSeeded();
  console.log(`activities=${result.activities} obligation links set=${result.links}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
