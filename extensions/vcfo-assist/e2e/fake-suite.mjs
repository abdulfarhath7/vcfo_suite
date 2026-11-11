// A FAKE VCFO Suite for the end-to-end test only. It serves a page to keep open in a tab, sets a
// session cookie, and answers the API calls the extension makes from inside that tab. It records
// every request so the test can check the payloads (no profile values, cookie present).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
// The recipes Suite serves, with the dev-key signature Suite makes when no production key is set
// (the bundle is generated from Suite's registry, so these are byte for byte Suite's answers).
const { recipes: SIGNED } = JSON.parse(readFileSync(path.join(here, '../src/recipes/bundled.json'), 'utf8'));

export const SENTINELS = [
  'Sentinel Alpha Private Limited',
  'Sentinel Beta Private Limited',
  'SENTINEL ALPHA PRIVATE LIMITED',
  'SENTINEL BETA PRIVATE LIMITED',
  'SENTINELWORD',
  'SENTINELA1234Z',
  'sentinel@example.test',
  'Sentinel Tower 1',
  'office@sentinel.test',
  'Subone',
  'SENTB1234C',
  'sub1@sentinel.test',
  'Dirtwo',
  'SENTE2222F',
  '09876543',
  '9681726354',
  '9281726352',
];

const PROFILE = {
  ok: true,
  schemaVersion: 1,
  companyName: 'Sentinel Alpha Private Limited',
  profile: {
    mcaLogin: { userId: '' },
    company: {
      proposedNames: ['Sentinel Alpha Private Limited', 'Sentinel Beta Private Limited'],
      type: 'New Company (Others)',
      class: 'Private',
      category: 'Company limited by shares',
      subCategory: 'Indian non-government company',
      nicCode: '62011',
      aoaEntrenched: false,
      capital: { authorized: 1000000, subscribed: 100000, equity: { classes: 1, className: 'Equity', authorizedShares: 100000, subscribedShares: 10000, faceValue: 10 } },
    },
    registeredOffice: { line1: 'Sentinel Tower 1', line2: 'Sentinel Road', pincode: '500081', area: 'Gachibowli', state: 'Telangana', country: 'India', email: 'office@sentinel.test', mobile: '9581726353', longitude: '78.3489', latitude: '17.4401', rocOffice: 'Registrar of Companies, Hyderabad' },
    // Subscriber 1 is also a director without a DIN (blocks 6c and 7b); subscriber 2 is not (6c).
    subscribers: [
      { index: 1, kind: 'individual', isDirector: true, firstName: 'Subone', surName: 'Sentinelson', father: { firstName: 'Fatherone', surName: 'Sentinelson' }, gender: 'Male', dob: '01/02/1980', nationality: 'India', placeOfBirth: 'Hyderabad, Telangana', citizenOfIndia: true, residentInIndia: true, pan: 'SENTB1234C', email: 'sub1@sentinel.test', mobile: '9481726350', shares: { equity: { number: 5000 } } },
      { index: 2, kind: 'individual', isDirector: false, firstName: 'Subtwo', surName: 'Sentineldottir', father: { firstName: 'Fathertwo', surName: 'Sentineldottir' }, gender: 'Female', dob: '03/04/1985', nationality: 'India', placeOfBirth: 'Pune, Maharashtra', pan: 'SENTC5678D', email: 'sub2@sentinel.test', mobile: '9381726351', shares: { equity: { number: 5000 } } },
    ],
    // Director 1 has a DIN (block 7a); director 2 has none (block 7b, after the subscriber-director).
    directors: [
      { id: 'e1', index: 1, firstName: 'Sentinel', surName: 'Sentinelli', din: '09876543', pan: 'SENTINELA1234Z', dob: '05/06/1975', email: 'sentinel@example.test', mobile: '9681726354' },
      { id: 'e4', index: 2, firstName: 'Dirtwo', surName: 'Sentinelova', father: { firstName: 'Fatherfour', surName: 'Sentinelova' }, gender: 'Female', nationality: 'India', citizenOfIndia: true, residentInIndia: true, pan: 'SENTE2222F', dob: '07/08/1990', email: 'dir2@sentinel.test', mobile: '9281726352' },
    ],
    agile: {},
    moa: {},
    aoa: {},
  },
  missing: [],
  notes: [],
};

// The shapes below follow docs/specs/vcfo-assist-agents/API.md. Bodies are checked as strictly as
// Suite's zod schemas: an unknown key is a 400, like the real routes.
const ALLOWED = {
  create: ['subAgent', 'portalHost', 'recipeVersion', 'fieldsTotal', 'state', 'mcaLoginLabel', 'device', 'extensionVersion'],
  update: ['status', 'state', 'fieldsTotal', 'fieldsFilled', 'heals', 'refusals', 'srn', 'error', 'blanks', 'dscSigners'],
  attestation: ['checks', 'evidenceDocumentIds', 'note'],
  resolve: ['fieldKey', 'fieldLabel', 'candidates', 'recipeId', 'runId'],
  patch: ['recipeId', 'recipeVersion', 'fieldKey', 'proposed', 'evidence', 'sourceTier', 'runId'],
};

const task = (id, title, form, extra = {}) => ({ type: 'task', id, title, form, status: 'later', recipeId: null, kind: 'portal-fill', ...extra });
const SPICE_A = { id: 'spice-a', agent: 'incorporation', title: 'Name reservation', form: 'SPICe+ Part A', status: 'beta', recipeId: 'spice-a', recipeVersion: SIGNED['spice-a'].recipe.version, stepId: 'pre-4', pack: 'mca-v3', kind: 'portal-fill', path: ['incorporation', 'spice-a'] };
const SPICE_B = { id: 'spice-b', agent: 'incorporation', title: 'Incorporation form', form: 'SPICe+ Part B', status: 'beta', recipeId: 'spice-b', recipeVersion: SIGNED['spice-b'].recipe.version, stepId: 'pre-10', pack: 'mca-v3', kind: 'portal-fill', path: ['incorporation', 'spice-b'] };
const CHALLAN_281 = { id: 'challan-281', agent: 'compliance', title: 'Monthly TDS challan', form: 'Challan 281 (ITNS 281)', status: 'later', recipeId: null, pack: 'income-tax-efiling', kind: 'challan-prepare', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'PAY'], note: 'The agent prepares the challan; you create it and pay it through your own bank.', path: ['compliance', 'income-tax-tds', 'tds', 'challan-281'] };

// Suite's catalog shape (API.md): the flat agents for older clients, the tree, and the packs.
const CATALOG = {
  ok: true,
  liveEnabled: false,
  liveHosts: [],
  extensionDisabled: false,
  minExtensionVersion: '0.1.0',
  firmContacts: { emails: ['desk@fake-firm.test'], phones: ['9123456780'] },
  mockHosts: ['localhost', '127.0.0.1'],
  packs: [
    { id: 'mca-v3', title: 'MCA V3 e-filing', hosts: ['www.mca.gov.in'], legalStatus: 'mock-only', needsCsOpinionFirst: false, live: false },
    { id: 'income-tax-efiling', title: 'Income tax e-filing', hosts: ['eportal.incometax.gov.in'], legalStatus: 'mock-only', needsCsOpinionFirst: false, live: false },
    { id: 'gst', title: 'GST portal', hosts: ['www.gst.gov.in'], legalStatus: 'mock-only', needsCsOpinionFirst: true, live: false },
  ],
  agents: [
    { id: 'incorporation', title: 'Incorporation', subAgents: [SPICE_A, SPICE_B] },
    { id: 'post-incorporation', title: 'Post-incorporation', subAgents: [{ id: 'inc-20a', title: 'Commencement of business', form: 'INC-20A', status: 'later', recipeId: null }] },
    { id: 'registration', title: 'Registration', subAgents: [{ id: 'gst-reg-01', title: 'GST registration', form: 'GST REG-01', status: 'later', recipeId: null, pack: 'gst' }] },
    { id: 'compliance', title: 'Compliance', subAgents: [{ id: 'dir-3-kyc', title: 'Director KYC', form: 'DIR-3 KYC', status: 'later', recipeId: null }, CHALLAN_281] },
  ],
  tree: [
    { type: 'group', id: 'incorporation', title: 'Incorporation', path: ['incorporation'], children: [{ type: 'task', ...SPICE_A }, { type: 'task', ...SPICE_B }] },
    { type: 'group', id: 'post-incorporation', title: 'Post-incorporation', path: ['post-incorporation'], children: [task('inc-20a', 'Commencement of business', 'INC-20A', { pack: 'mca-v3' })] },
    { type: 'group', id: 'registration', title: 'Registration', path: ['registration'], children: [task('gst-reg-01', 'GST registration', 'GST REG-01', { pack: 'gst' })] },
    {
      type: 'group',
      id: 'compliance',
      title: 'Compliance',
      path: ['compliance'],
      children: [
        { type: 'group', id: 'mca-annual', title: 'MCA annual filings', children: [task('dir-3-kyc', 'Director KYC', 'DIR-3 KYC', { pack: 'mca-v3' })] },
        { type: 'group', id: 'income-tax-tds', title: 'Income tax & TDS', children: [{ type: 'group', id: 'tds', title: 'TDS', children: [{ type: 'task', ...CHALLAN_281 }] }] },
      ],
    },
  ],
};

export async function startFakeSuite(port = 4319) {
  const log = [];
  // Runs by id, with the certifier's checks once recorded (SAFETY.md G17).
  const runs = new Map();
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const entry = { method: req.method, path: url.pathname, body, cookie: req.headers.cookie ?? '', origin: req.headers.origin ?? '' };
      log.push(entry);
      const strict = (keys) => {
        try {
          const parsed = JSON.parse(body || '{}');
          return Object.keys(parsed).every((k) => keys.includes(k));
        } catch {
          return false;
        }
      };
      const json = (status, value) => {
        entry.status = status;
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(value));
      };
      const p = url.pathname;
      if (p === '/' || p === '/suite.html') {
        entry.status = 200;
        res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': 'fake-session=staff-1; Path=/; HttpOnly; SameSite=Lax' });
        res.end('<!doctype html><title>FAKE Suite</title><h1>FAKE VCFO Suite (test only)</h1><p>Signed in as a test lead.</p>');
        return;
      }
      if (p === '/__log') return json(200, log);
      if (!entry.cookie.includes('fake-session=staff-1')) return json(401, { error: 'unauthorized' });
      if (p === '/api/engagements' && req.method === 'GET') return json(200, { engagements: [{ id: 'eng-1', slug: 'sentinel', companyName: 'Sentinel Alpha Private Limited' }] });
      if (p === '/api/assist/catalog') return json(200, CATALOG);
      const recipeId = /^\/api\/assist\/recipes\/([\w-]+)$/.exec(p)?.[1];
      if (recipeId) return SIGNED[recipeId] ? json(200, { ok: true, ...SIGNED[recipeId] }) : json(404, { ok: false, error: 'not_found' });
      if (p === '/api/engagements/eng-1/assist-profile') return json(200, PROFILE);
      if (p === '/api/engagements/eng-1/assist-runs' && req.method === 'POST') {
        if (!strict(ALLOWED.create)) return json(400, { ok: false, error: 'unrecognized_keys' });
        const created = JSON.parse(body);
        const run = { id: randomUUID(), status: 'running', state: 'READY', subAgent: created.subAgent, evidence: { mcaLoginLabel: created.mcaLoginLabel ?? null, device: created.device ?? null }, attestation: null };
        runs.set(run.id, run);
        return json(201, { ok: true, run });
      }
      const runId = /^\/api\/engagements\/eng-1\/assist-runs\/([0-9a-f-]{36})$/.exec(p)?.[1];
      if (runId && req.method === 'PATCH') {
        if (!strict(ALLOWED.update)) return json(400, { ok: false, error: 'unrecognized_keys' });
        const patch = JSON.parse(body);
        const run = runs.get(runId);
        if (run && patch.dscSigners) run.evidence.dscSigners = patch.dscSigners;
        if (run && patch.state) run.state = patch.state;
        return json(200, { ok: true, run });
      }
      if (runId && req.method === 'GET') {
        const run = runs.get(runId);
        return run ? json(200, { ok: true, run }) : json(404, { ok: false, error: 'not_found' });
      }
      const attestRunId = /^\/api\/engagements\/eng-1\/assist-runs\/([0-9a-f-]{36})\/attestation$/.exec(p)?.[1];
      if (attestRunId && req.method === 'POST') {
        // The certifier's checks, as the Suite dialog sends them: strict, nothing defaults to ticked.
        if (!strict(ALLOWED.attestation)) return json(400, { ok: false, error: 'unrecognized_keys' });
        const run = runs.get(attestRunId);
        if (!run) return json(404, { ok: false, error: 'not_found' });
        if (run.attestation) return json(409, { ok: false, error: 'already_attested' });
        const { checks = {} } = JSON.parse(body);
        const partB = run.subAgent === 'spice-b';
        if (checks.fieldsCheckedAgainstRecords !== true || (partB && (!checks.registeredOffice || !checks.subscriberSignatures))) {
          return json(400, { ok: false, error: 'attestation_incomplete' });
        }
        run.attestation = { id: randomUUID(), runId: run.id, certifierName: 'Fake Certifier', checks, createdAt: new Date().toISOString() };
        return json(201, { ok: true, attestation: run.attestation });
      }
      if (p === '/api/assist/resolve') {
        if (!strict(ALLOWED.resolve)) return json(400, { ok: false, error: 'unrecognized_keys' });
        return json(200, { ok: true, choice: null, confidence: 0, tier: 'T1', tokens: 0, aiCalls: 0 });
      }
      if (p === '/api/assist/patches') {
        if (!strict(ALLOWED.patch)) return json(400, { ok: false, error: 'unrecognized_keys' });
        return json(201, { ok: true });
      }
      return json(404, { error: 'not_found' });
    });
  });
  await new Promise((resolve) => server.listen(port, 'localhost', resolve));
  return { server, log, runs };
}
