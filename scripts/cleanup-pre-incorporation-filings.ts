/**
 * Remove the statutory filings that should never have existed: filings of a company that is not
 * incorporated yet, and filings whose period falls before the company's incorporation day.
 *
 *   npm run filings:pre-coi                  # local database: list what would go, change nothing
 *   npm run filings:pre-coi -- --yes         # local database: delete it
 *   npm run filings:pre-coi:prod             # production: list what would go, change nothing
 *   npm run filings:pre-coi:prod -- --yes    # production: take an RDS snapshot, then delete
 *
 * Why: before the generator checked incorporation, a company still in pre-incorporation got the
 * fixed-calendar filings (advance tax, DIR-3 KYC, DPT-3, MSME-1) as overdue rows. The generator
 * and every reader now refuse them; this script removes rows already stored.
 *
 * What is DELETED: a filing `selectPreIncorporationFilings` marks bad and on which nobody
 * recorded any work. Its own side rows (workflow, details, reminders) go with it by ON DELETE
 * CASCADE; they hold nothing, or the filing would have counted as worked.
 *
 * What is KEPT: every filing of an incorporated company dated on or after incorporation, and
 * every bad filing with recorded work (filed, a proof, an acknowledgement, an amount, a document
 * request, a field, a checklist tick, a timed session, a stage moved on). Those are listed so a
 * person can decide; the app hides them from every screen in the meantime.
 *
 * Running it twice is safe: a second run finds nothing left to delete. With `--yes` the deletes
 * run in one transaction, and each delete re-checks that the filing is still unfiled.
 */
import './load-env';

import { sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  selectPreIncorporationFilings,
  type FilingCleanupRow,
} from '../src/lib/compliance/pre-incorporation-cleanup';

const apply = process.argv.includes('--yes');

type Raw = Omit<FilingCleanupRow, 'linkedCount'> & { linkedCount: string | number };

/** Every stored filing with the facts the selection needs. Dates come back as text. */
const FILINGS = sql`
  select
    ci.id::text as "id",
    ci.engagement_id::text as "engagementId",
    e.company_name as "companyName",
    coalesce(o.particular, ci.obligation_id) as "particular",
    ci.period_label as "periodLabel",
    ci.due_date::text as "dueDate",
    ci.period_end::text as "periodEnd",
    ci.status as "status",
    ci.filed_on::text as "filedOn",
    ci.evidence_url as "evidenceUrl",
    ci.filed_note as "filedNote",
    ci.window_from::text as "windowFrom",
    ci.window_to::text as "windowTo",
    e.incorporation_date::text as "incorporationDate",
    e.stage::text as "stage",
    e.checklist_state -> 'pre-12' as "coiStep",
    d.acknowledgement_no as "acknowledgementNo",
    d.amount_paid::text as "amountPaid",
    d.filed_by::text as "filedBy",
    d.data_received_on::text as "dataReceivedOn",
    d.preparing_since::text as "preparingSince",
    d.approved_on::text as "approvedOn",
    w.stage as "workflowStage",
    w.submitted_at::text as "submittedAt",
    (
      (select count(*) from compliance_instance_proofs p where p.instance_id = ci.id)
      -- A due date moved by an approved calendar update is not work on the filing.
      + (select count(*) from filing_events fe where fe.instance_id = ci.id and fe.label not like 'Due date moved from %')
      + (select count(*) from client_need_meta m where m.compliance_instance_id = ci.id)
      + (select count(*) from document_request_details r where r.subject_key = ci.id::text)
      + (select count(*) from compliance_subject_fields f where f.subject_key = ci.id::text)
      + (select count(*) from compliance_checklist_checks c where c.subject_key = ci.id::text)
      + (select count(*) from assist_runs a where a.subject_key = ci.id::text)
      + (select count(*) from work_sessions s where s.item_key = 'filing:' || ci.id::text)
      + (select count(*) from work_checklist_items wc where wc.item_key = 'filing:' || ci.id::text)
      + (select count(*) from time_blocks tb where tb.item_key = 'filing:' || ci.id::text)
      + (select count(*) from item_window_requests wr where wr.item_key = 'filing:' || ci.id::text)
    ) as "linkedCount"
  from compliance_instances ci
  join engagements e on e.id = ci.engagement_id
  left join compliance_obligations o on o.id = ci.obligation_id
  left join compliance_instance_details d on d.instance_id = ci.id
  left join compliance_instance_workflow w on w.instance_id = ci.id
  -- Only rows that can be bad: a company without an incorporation date, or a filing dated before it.
  where e.incorporation_date is null
     or ci.due_date < e.incorporation_date
     or ci.period_end < e.incorporation_date
  order by e.company_name, ci.due_date`;

async function main() {
  const res = await db.execute(FILINGS);
  const rows: FilingCleanupRow[] = (res.rows as Raw[]).map((r) => ({ ...r, linkedCount: Number(r.linkedCount) }));
  const { remove, keep } = selectPreIncorporationFilings(rows);

  const line = (r: (typeof remove)[number]) =>
    `  ${r.companyName} · ${r.particular}${r.periodLabel ? ` · ${r.periodLabel}` : ''} · due ${r.dueDate} · ${
      r.reason === 'not-incorporated' ? 'company not incorporated' : `before incorporation on ${r.incorporationDate}`
    }`;

  console.log(`Checked ${rows.length} filing(s) of companies without an incorporation date or dated before it.`);
  console.log(`\nTo delete (${remove.length}, nobody worked on them):`);
  for (const r of remove) console.log(line(r));
  console.log(`\nKept for review (${keep.length}, someone recorded work on them; the app hides them):`);
  for (const r of keep) console.log(line(r));

  if (!apply) {
    console.log('\nDry run: nothing was changed. Run again with --yes to delete the filings listed above.');
    return;
  }
  if (remove.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  let deleted = 0;
  await db.transaction(async (tx) => {
    const ids = remove.map((r) => r.id);
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const out = await tx.execute(sql`
        delete from compliance_instances
        where id in (${sql.join(chunk.map((id) => sql`${id}::uuid`), sql`, `)})
          and filed_on is null
          and coalesce(status, '') not in ('filed', 'in-progress')
        returning id`);
      deleted += out.rows.length;
    }
  });
  console.log(`\nDeleted ${deleted} filing(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
