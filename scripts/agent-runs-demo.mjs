#!/usr/bin/env node
/**
 * Local demo rows for the card agent screens (Agents today, Agent runs, Agent results):
 * live browser sessions, VCFO Assist runs, GST return runs and "your turn" OTP requests on the
 * demo engagements (`slug like 'demo-%'`) only.
 *
 *   node scripts/agent-runs-demo.mjs           # inserts the rows (removes any earlier demo rows first)
 *   node scripts/agent-runs-demo.mjs --clean   # removes them
 *
 * Every row is marked so it can be found and removed: sessions have `node = 'demo-agent-runs'`,
 * Assist runs have `device.installId = 'demo-agent-runs'`, GST runs have
 * `reference_id = 'demo-agent-runs'`, and the OTP requests hang off those rows. Local only: the
 * script refuses to run when DB_SECRET_ARN is set (RDS).
 */
import pg from 'pg';
import { pgConfig } from './db-connect.mjs';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file; fall through to the real environment.
  }
}

if (process.env.DB_SECRET_ARN?.trim()) {
  console.error('This script writes demo rows and runs against the local database only.');
  process.exit(1);
}

const MARK = 'demo-agent-runs';
const CLEAN = process.argv.includes('--clean');
const client = new pg.Client(pgConfig());
await client.connect();

async function clean() {
  await client.query(
    `delete from agent_otp_requests where subject_id in (
       select id::text from live_browser_sessions where node = $1
       union select id::text from gst_return_runs where reference_id = $1)`,
    [MARK],
  );
  const s = await client.query('delete from live_browser_sessions where node = $1', [MARK]);
  const g = await client.query('delete from gst_return_runs where reference_id = $1', [MARK]);
  const r = await client.query(`delete from assist_agent_runs where device->>'installId' = $1`, [MARK]);
  console.log(`Removed ${s.rowCount} sessions, ${g.rowCount} GST runs, ${r.rowCount} Assist runs.`);
}

try {
  await clean();
  if (!CLEAN) {
    const eng = Object.fromEntries((await client.query(`select slug, id from engagements where slug like 'demo-%' and deleted_at is null`)).rows.map((r) => [r.slug, r.id]));
    const who = Object.fromEntries(
      (await client.query(`select email, id, name from profiles where email in ('lead-divya@demo.vcfo.local','lead-sneha@demo.vcfo.local','admin-nadia@demo.vcfo.local')`)).rows.map((r) => [r.email.split('@')[0], r]),
    );
    const divya = who['lead-divya'];
    const sneha = who['lead-sneha'];
    const need = ['demo-kestrel-robotics', 'demo-solstice-energy', 'demo-halcyon-payments', 'demo-ironclad-labs', 'demo-meridian-health', 'demo-vantage-media'];
    for (const slug of need) if (!eng[slug]) throw new Error(`Demo engagement ${slug} is missing; run npm run db:seed-demo first.`);
    const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
    const device = { installId: MARK, userAgent: 'Demo', extensionVersion: '0.9.0' };

    const run = async (v) =>
      (
        await client.query(
          `insert into assist_agent_runs (engagement_id, user_id, user_name, user_email, agent, sub_agent, recipe_id, recipe_version, status, state,
             fields_total, fields_filled, heals, refusals, srn, blanks, device, client_ips, started_at, finished_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,'2.0.0',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz,$19::timestamptz,coalesce($19::timestamptz,$18::timestamptz)) returning id`,
          [
            v.eng, v.user.id, v.user.name, `${v.user.email ?? ''}`, v.agent, v.sub, v.sub, v.status, v.state, v.total, v.filled,
            JSON.stringify(v.heals ?? []), JSON.stringify(v.refusals ?? []), v.srn ?? null, JSON.stringify(v.blanks ?? []), JSON.stringify(device),
            JSON.stringify([{ ip: '49.36.12.7', firstAt: v.started, lastAt: v.finished ?? v.started, calls: 12 }]), v.started, v.finished ?? null,
          ],
        )
      ).rows[0].id;

    const session = async (v) =>
      (
        await client.query(
          `insert into live_browser_sessions (engagement_id, task_id, run_id, started_by, started_by_name, portal_host, portal_login_label, status, gate,
             progress_text, fields_total, fields_done, node, egress_ip, viewers, created_at, ready_at, last_activity_at, ended_at, end_reason)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'13.232.10.4',$14,$15::timestamptz,$15::timestamptz,$16::timestamptz,$17::timestamptz,$18) returning id`,
          [
            v.eng, v.task, v.runId ?? null, v.user.id, v.user.name, v.host, v.login, v.status, v.gate ?? null, v.progress ?? null, v.total, v.done, MARK,
            JSON.stringify([{ userId: v.user.id, ip: '49.36.12.7', firstAt: v.created, lastAt: v.last }]), v.created, v.last, v.ended ?? null, v.endReason ?? null,
          ],
        )
      ).rows[0].id;

    const gst = async (v) =>
      (
        await client.query(
          `insert into gst_return_runs (engagement_id, gstin, form, period, status, arn, reference_id, checks, created_by, created_at, updated_at, filed_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,coalesce($11::timestamptz,$10::timestamptz),$11::timestamptz) returning id`,
          [v.eng, v.gstin, v.form, v.period, v.status, v.arn ?? null, MARK, JSON.stringify(v.checks ?? {}), v.user.id, v.created, v.filed ?? null],
        )
      ).rows[0].id;

    // Your turn: the client's consent OTP on Kestrel's GSTR-3B for October.
    const g1 = await gst({ eng: eng['demo-kestrel-robotics'], gstin: '29AAKCK1234R1Z5', form: 'gstr3b', period: '102026', status: 'consent_needed', user: divya, created: ago(4) });
    await client.query(
      `insert into agent_otp_requests (engagement_id, purpose, subject_type, subject_id, gstin, sent_to, audience, status, requested_by, requested_at, expires_at)
       values ($1,'gstn_consent','gst_return_run',$2,'29AAKCK1234R1Z5','mobile ending 4821','client','pending',$3,$4,$5)`,
      [eng['demo-kestrel-robotics'], g1, divya.id, ago(4), new Date(Date.now() + 10 * 60_000).toISOString()],
    );
    // Your turn: a captcha on Solstice's GST registration in the live browser.
    await session({ eng: eng['demo-solstice-energy'], task: 'gst-reg-01', user: divya, host: 'reg.gst.gov.in (mock)', login: 'solstice-gst', status: 'your_turn', gate: 'CAPTCHA', progress: 'Waiting at the captcha', total: 60, done: 0, created: ago(2), last: ago(1) });
    // Running: SPICe+ Part B on Kestrel, page 4 of 9, with the Assist run it drives.
    const r1 = await run({ eng: eng['demo-kestrel-robotics'], user: divya, agent: 'incorporation', sub: 'spice-b', status: 'running', state: 'FILL', total: 120, filled: 64, heals: [{ field: 'capital.authorised', tier: 'T1', ok: true }], started: ago(9) });
    await session({ eng: eng['demo-kestrel-robotics'], task: 'spice-b', runId: r1, user: divya, host: 'www.mca.gov.in (mock)', login: 'divya@sbc', status: 'running', progress: 'Page 4 of 9', total: 120, done: 64, created: ago(9), last: ago(0) });
    // Waiting for data: Meridian's GSTR-3B.
    await gst({ eng: eng['demo-meridian-health'], gstin: '27AAMCM5678P1Z2', form: 'gstr3b', period: '102026', status: 'draft', user: sneha ?? divya, created: ago(60) });
    // Filed today through the API: Halcyon's GSTR-1, with the EVC OTP answered.
    const g2 = await gst({
      eng: eng['demo-halcyon-payments'], gstin: '29AAHCH4321K1Z9', form: 'gstr1', period: '102026', status: 'filed', arn: 'AA291026000123X', user: sneha ?? divya,
      created: ago(95), filed: ago(80), checks: { figures: { by: (sneha ?? divya).id, at: ago(85) } },
    });
    await client.query(
      `insert into agent_otp_requests (engagement_id, purpose, subject_type, subject_id, gstin, sent_to, audience, status, requested_by, requested_at, answered_by, answered_at, expires_at)
       values ($1,'evc','gst_return_run',$2,'29AAHCH4321K1Z9','mobile ending 1190','staff','answered',$3,$4,$3,$5,$5)`,
      [eng['demo-halcyon-payments'], g2, (sneha ?? divya).id, ago(83), ago(82)],
    );
    // Done this month on the extension: Name reservation on Ironclad, with an SRN.
    await run({
      eng: eng['demo-ironclad-labs'], user: divya, agent: 'incorporation', sub: 'spice-a', status: 'done', state: 'DONE', total: 18, filled: 18, srn: 'AB1234567',
      heals: [{ field: 'name.option2', tier: 'T3', ok: true }], refusals: [{ kind: 'captcha', target: 'captcha' }], started: ago(60 * 24 * 3), finished: ago(60 * 24 * 3 - 12),
    });
    // Done last week in the live browser: SPICe+ Part B on Vantage.
    const r2 = await run({ eng: eng['demo-vantage-media'], user: divya, agent: 'incorporation', sub: 'spice-b', status: 'done', state: 'DONE', total: 120, filled: 116, srn: 'AB7654321', blanks: [{ field: 'office.landmark', reason: 'missing' }], started: ago(60 * 24 * 6), finished: ago(60 * 24 * 6 - 34) });
    await session({ eng: eng['demo-vantage-media'], task: 'spice-b', runId: r2, user: divya, host: 'www.mca.gov.in (mock)', login: 'divya@sbc', status: 'done', total: 120, done: 116, created: ago(60 * 24 * 6), last: ago(60 * 24 * 6 - 34), ended: ago(60 * 24 * 6 - 34), endReason: 'done' });
    console.log('Inserted the demo agent runs.');
  }
} finally {
  await client.end();
}
