#!/usr/bin/env node
/**
 * One-off backfill of `engagement_step_events` (G-13) from the audit trail.
 *
 *   node scripts/backfill-step-events.mjs           # dry run: prints what it would write
 *   node scripts/backfill-step-events.mjs --apply   # writes the rows
 *
 * The app writes a step event on every status change from now on (`updateChecklistState`).
 * Steps that moved before that have no events, so their "opened at" and "days in step" are
 * blank. This script seeds them from evidence that already exists, and only from evidence:
 *
 *   - opened at  = the earliest audit event that names the step (`metadata.itemId` or
 *                  `metadata.stepId`) on that engagement;
 *   - finished at (completed steps only) = the step's `reviewedAt`, else its `completedOn`,
 *                  else the latest audit event that names the step.
 *
 * Per step it writes one event (null → the current status, at the opening time), or, for a
 * completed step whose finish is later than its opening, two (null → in-progress at the
 * opening, then in-progress → completed at the finish). A step with no audit event naming it
 * is skipped, and so is any engagement and step that already has events, so the script is
 * safe to run twice. Actor is left null: the audit trail does not say who changed the status.
 *
 * Reads DATABASE_URL from the environment, `.env.local` or `.env`.
 */
import pg from 'pg';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file; fall through to the real environment.
  }
}

const APPLY = process.argv.includes('--apply');

function toTime(value) {
  if (!value || typeof value !== 'string') return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isFinite(t) ? new Date(t) : null;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: engagements } = await client.query(
      `select id, checklist_state from engagements where deleted_at is null`,
    );
    const { rows: existing } = await client.query(
      `select distinct engagement_id, step_id from engagement_step_events`,
    );
    const seeded = new Set(existing.map((r) => `${r.engagement_id}:${r.step_id}`));

    // Earliest and latest audit time per engagement and step.
    const { rows: audit } = await client.query(`
      select engagement_id,
             coalesce(metadata->>'itemId', metadata->>'stepId') as step_id,
             min(created_at) as first_at,
             max(created_at) as last_at
        from audit_events
       where engagement_id is not null
         and coalesce(metadata->>'itemId', metadata->>'stepId') is not null
       group by engagement_id, coalesce(metadata->>'itemId', metadata->>'stepId')
    `);
    const evidence = new Map(audit.map((r) => [`${r.engagement_id}:${r.step_id}`, r]));

    const inserts = [];
    let skippedNoEvidence = 0;
    let skippedSeeded = 0;
    for (const eng of engagements) {
      const state = eng.checklist_state && typeof eng.checklist_state === 'object' ? eng.checklist_state : {};
      for (const [stepId, slice] of Object.entries(state)) {
        const status = slice && typeof slice === 'object' && typeof slice.status === 'string' ? slice.status : 'not-started';
        if (status === 'not-started') continue;
        const key = `${eng.id}:${stepId}`;
        if (seeded.has(key)) {
          skippedSeeded += 1;
          continue;
        }
        const ev = evidence.get(key);
        if (!ev) {
          skippedNoEvidence += 1;
          continue;
        }
        const openedAt = new Date(ev.first_at);
        if (status === 'completed') {
          const finishedAt = toTime(slice.reviewedAt) ?? toTime(slice.completedOn) ?? new Date(ev.last_at);
          if (finishedAt.getTime() > openedAt.getTime()) {
            inserts.push([eng.id, stepId, null, 'in-progress', openedAt]);
            inserts.push([eng.id, stepId, 'in-progress', 'completed', finishedAt]);
            continue;
          }
        }
        inserts.push([eng.id, stepId, null, status, openedAt]);
      }
    }

    console.log(`Engagements read: ${engagements.length}`);
    console.log(`Events to write: ${inserts.length}`);
    console.log(`Steps skipped (already have events): ${skippedSeeded}`);
    console.log(`Steps skipped (no audit event names them): ${skippedNoEvidence}`);

    if (!APPLY) {
      console.log('Dry run. Run again with --apply to write the rows.');
      return;
    }

    await client.query('begin');
    for (const [engagementId, stepId, fromStatus, toStatus, at] of inserts) {
      await client.query(
        `insert into engagement_step_events (engagement_id, step_id, from_status, to_status, actor_id, at)
         values ($1, $2, $3, $4, null, $5)`,
        [engagementId, stepId, fromStatus, toStatus, at],
      );
    }
    await client.query('commit');
    console.log(`Wrote ${inserts.length} events.`);
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
