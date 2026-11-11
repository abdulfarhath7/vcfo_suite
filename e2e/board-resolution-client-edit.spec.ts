import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { login, onLocalDb, type DemoRole } from './helpers/login';

/**
 * BR-04 / BR-05 / BR-06 on a running app: the client edits the firm's board resolution, and the
 * edit goes edit → confirm → email → receipt → Manager → Admin → back to the Client, with every
 * out-of-order move refused. A return goes to the Lead and the Client, who may both edit it, and
 * only the Lead sends it to the Manager again. Seeds a finalized draft for Kestrel, so it runs on a local database only.
 */

// The demo seed gives Kestrel a new id on every rebuild, so the spec looks it up by name.
let API = '';
const DRAFT = [
  'BOARD RESOLUTION',
  'RESOLVED THAT the company be incorporated as Kestrel Robotics India Private Limited.',
  'RESOLVED FURTHER THAT the directors be authorised to sign the documents.',
  'Place: Bengaluru',
].join('\n');

let seeded = false;

test.beforeAll(async () => {
  await onLocalDb(async (db) => {
    const found = await db.query<{ id: string }>(`select id from engagements where company_name ilike 'Kestrel Robotics%' order by created_at limit 1`);
    const KESTREL = found.rows[0]?.id;
    if (!KESTREL) return;
    API = `/api/engagements/${KESTREL}/board-resolution/client-edit`;
    await db.query(
      `insert into engagement_board_resolutions (engagement_id, content, status, drafted_at, finalized_at, updated_at)
       values ($1, $2, 'finalized', now(), now(), now())
       on conflict (engagement_id) do update set status = 'finalized', content = excluded.content, signed_storage_path = null`,
      [KESTREL, DRAFT],
    );
    await db.query(
      `update engagements set checklist_state = jsonb_set(checklist_state, '{pre-2}',
         (coalesce(checklist_state->'pre-2', '{}'::jsonb) - 'brClientEdit') || jsonb_build_object('deliveredToClientAt', now()::text))
       where id = $1`,
      [KESTREL],
    );
    seeded = true;
  });
});

async function as(browser: Browser, role: DemoRole): Promise<APIRequestContext> {
  const page = await (await browser.newContext()).newPage();
  await login(page, role);
  return page.request;
}

async function call(req: APIRequestContext, method: 'GET' | 'PUT' | 'POST', data?: unknown) {
  const res = await req.fetch(API, { method, data });
  return { status: res.status(), body: (await res.json()) as { view?: { stage: string | null; holder: string | null; actions?: string[]; changes: unknown[]; audit?: Array<{ summary: string }>; original: string[] }; code?: string } };
}

test('the client edit goes through the seven steps in order', async ({ browser }) => {
  test.skip(!seeded, 'needs the local demo database');
  test.setTimeout(180_000);
  const client = await as(browser, 'client');
  const lead = await as(browser, 'lead');
  const manager = await as(browser, 'manager');
  const admin = await as(browser, 'admin');

  const first = await call(client, 'GET');
  expect(first.body.view?.stage).toBeNull();
  const paragraphs = [...first.body.view!.original];
  paragraphs[1] = 'RESOLVED THAT the company be incorporated as Kestrel Robotics India Private Limited with its office in Bengaluru.';

  // Only the client edits, and only the document that is with them.
  expect((await call(lead, 'PUT', { paragraphs })).status).toBe(409);
  const saved = await call(client, 'PUT', { paragraphs });
  expect(saved.body.view).toMatchObject({ stage: 'editing', holder: 'With you' });
  expect(saved.body.view?.changes).toHaveLength(1);

  expect((await call(client, 'POST', { action: 'send' })).body.code).toBe('wrong_stage');
  expect((await call(client, 'POST', { action: 'confirm' })).body.view?.stage).toBe('confirmed');
  // BR-03: the client reads the Lead's first name in the chip.
  const sent = await call(client, 'POST', { action: 'send', note: 'We added the office city.' });
  expect(sent.body.view?.stage).toBe('sent');
  expect(sent.body.view?.holder).toMatch(/^With Lead( · \S+)?$/);

  // The admin never approves before the manager.
  expect((await call(admin, 'POST', { action: 'admin-approve' })).status).toBe(409);
  expect((await call(lead, 'POST', { action: 'receive' })).body.view).toMatchObject({ stage: 'manager', holder: 'With Manager (approval)' });

  // A return needs a reason and goes back to the Lead and the Client, who may both edit it.
  expect((await call(manager, 'POST', { action: 'return' })).body.code).toBe('return_needs_reason');
  expect((await call(manager, 'POST', { action: 'return', note: 'Use the registered office wording.' })).body.view).toMatchObject({ stage: 'returned', holder: 'With Lead and Client' });
  const returned = await call(client, 'GET');
  expect(returned.body.view?.holder).toMatch(/^With Lead( · \S+)? and you$/);
  expect(returned.body.view).toMatchObject({ actions: ['correct'] });

  // The client corrects first; the save is audited and the stage stays "returned".
  paragraphs[1] = 'RESOLVED THAT the company be incorporated as Kestrel Robotics India Private Limited with its registered office at Bengaluru.';
  expect((await call(client, 'PUT', { paragraphs })).body.view?.stage).toBe('returned');
  // The client cannot skip the chain.
  expect((await call(client, 'POST', { action: 'resubmit' })).status).toBe(409);
  // The lead corrects too, and only the lead sends it to the manager again.
  paragraphs[1] = 'RESOLVED THAT the company be incorporated as Kestrel Robotics India Private Limited with its registered office in Bengaluru.';
  expect((await call(lead, 'PUT', { paragraphs })).body.view?.stage).toBe('returned');
  expect((await call(lead, 'POST', { action: 'resubmit' })).body.view?.stage).toBe('manager');
  // Back with the manager, the client edits no more.
  expect((await call(client, 'PUT', { paragraphs })).status).toBe(409);

  expect((await call(manager, 'POST', { action: 'manager-approve' })).body.view).toMatchObject({ stage: 'admin', holder: 'With Admin (approval)' });
  expect((await call(admin, 'POST', { action: 'admin-approve' })).body.view).toMatchObject({ stage: 'approved', holder: 'With Lead' });
  expect((await call(lead, 'POST', { action: 'send-final' })).body.view).toMatchObject({ stage: 'final', holder: 'With Client' });

  // The audit record: every move, with who did it; the client does not get the staff record.
  const record = await call(manager, 'GET');
  const summaries = record.body.view?.audit?.map((row) => row.summary) ?? [];
  expect(summaries.length).toBeGreaterThanOrEqual(10);
  expect(summaries.some((s) => /changed 1 paragraph/.test(s))).toBe(true);
  expect(summaries.some((s) => /returned the edited board resolution: Use the registered office wording/.test(s))).toBe(true);
  // Both corrections after the return are on the record, each with its role.
  expect(summaries.some((s) => /\(Client\) changed 1 paragraph/.test(s))).toBe(true);
  expect(summaries.some((s) => /\(Lead\) changed 1 paragraph/.test(s))).toBe(true);
  // The firm's original version is never replaced.
  expect(record.body.view?.original).toEqual(first.body.view!.original);
  expect((await call(client, 'GET')).body.view?.audit).toBeUndefined();
});
