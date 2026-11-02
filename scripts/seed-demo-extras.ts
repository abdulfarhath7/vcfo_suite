/**
 * Demo data, second layer — run by `scripts/seed-demo.ts` after the projects
 * exist. Fills every other surface so each screen has something to show:
 * proposed directors, schedules, client team members, document requests and
 * their uploads, file requests, "What SBC is doing", timeline requests,
 * manager change requests, filing proofs and details, reminders, credentials,
 * notifications, activity, announcements, the knowledge bank, portal prefs,
 * and memberships so the four `@vcfo.local` seed logins see projects too.
 *
 * Scope and safety follow seed-demo: rows hang off `demo-` engagements or
 * `@demo.vcfo.local` profiles (both deleted on re-run), and the few firm-wide
 * rows are tagged so `clearDemoExtras` can find them again.
 */
import bcrypt from 'bcryptjs';
import { and, eq, inArray, isNotNull, like } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  activity,
  announcementReads,
  announcements,
  clientAccountMeta,
  clientFileRequests,
  clientInvites,
  clientNeedMeta,
  clientTimelineRequests,
  clientWorkItems,
  complianceInstanceDetails,
  complianceInstanceProofs,
  complianceInstances,
  complianceReminders,
  documentRequestDetails,
  documentRequestFiles,
  documentRequests,
  engagementChangeRequests,
  engagementClients,
  engagementCredentials,
  engagementLeads,
  engagementManagers,
  engagements,
  invites,
  knowledgeBankFiles,
  knowledgeBankFolders,
  notificationPrefs,
  notifications,
  profiles,
  tasks,
} from '../src/db/schema';
import { encryptSecrets } from '../src/lib/credentials-crypto';
import { seedPlaceholders } from '../src/storage/demo-placeholders';

const DEMO_EMAIL_DOMAIN = '@demo.vcfo.local';
const DEMO_PASSWORD = 'demo1234';
/** Firm-wide rows (announcements) carry this so a re-run can find them. */
const DEMO_TAG = 'demo-seed';
const SEED_LOGINS = ['super@vcfo.local', 'admin@vcfo.local', 'manager@vcfo.local', 'intern@vcfo.local', 'client@vcfo.local'];

export type DemoProject = {
  id: string;
  slug: string;
  companyName: string;
  clientName: string;
  stage: string;
  done: number;
  startedDaysAgo: number;
  incorporatedDaysAgo?: number;
  leadKey: string | null;
  managerKey: string;
  clientKey: string;
  clientScopeId: string;
};

export type DemoPerson = { key: string; name: string; role: string };

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]!;

/* ------------------------------------------------------------------ *
 * Cleanup of rows that do not cascade from demo engagements / people
 * ------------------------------------------------------------------ */

export async function clearDemoExtras(): Promise<void> {
  await db.delete(announcements).where(like(announcements.externalId, `${DEMO_TAG}-%`));

  const demoPeople = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(like(profiles.email, `%${DEMO_EMAIL_DOMAIN}`));
  const ids = demoPeople.map((p) => p.id);
  if (ids.length > 0) {
    // Knowledge bank references are `restrict`, so they must go before the people.
    await db.delete(knowledgeBankFiles).where(inArray(knowledgeBankFiles.uploadedBy, ids));
    for (let pass = 0; pass < 5; pass += 1) {
      const folders = await db
        .select({ id: knowledgeBankFolders.id })
        .from(knowledgeBankFolders)
        .where(inArray(knowledgeBankFolders.createdBy, ids));
      if (folders.length === 0) break;
      const parents = await db
        .select({ parentId: knowledgeBankFolders.parentId })
        .from(knowledgeBankFolders)
        .where(and(isNotNull(knowledgeBankFolders.parentId), inArray(knowledgeBankFolders.createdBy, ids)));
      const parentIds = new Set(parents.map((p) => p.parentId));
      const leaves = folders.filter((f) => !parentIds.has(f.id)).map((f) => f.id);
      if (leaves.length > 0) await db.delete(knowledgeBankFolders).where(inArray(knowledgeBankFolders.id, leaves));
    }
  }

  // Seed logins are kept across runs, so their demo notifications are removed by title.
  const seeded = await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.email, SEED_LOGINS));
  if (seeded.length > 0) {
    await db.delete(notifications).where(
      and(
        inArray(notifications.userId, seeded.map((s) => s.id)),
        inArray(notifications.title, NOTIFICATION_TITLES),
      ),
    );
  }
}

/* ------------------------------------------------------------------ *
 * Content
 * ------------------------------------------------------------------ */

const FIRST = ['Priya', 'Rahul', 'Ananya', 'Karthik', 'Meera', 'Siddharth', 'Kavya', 'Aditya', 'Ishaan', 'Neha'];
const LAST = ['Sharma', 'Reddy', 'Menon', 'Gupta', 'Pillai', 'Chatterjee', 'Joshi', 'Agarwal', 'Bhat', 'Kapoor'];
const FOREIGN_FIRST = ['Michael', 'Sarah', 'Thomas', 'Emma', 'Lukas', 'Hannah', 'Daniel', 'Olivia'];
const FOREIGN_LAST = ['Carter', 'Schmidt', 'Wright', 'Tan', 'Müller', 'Brooks', 'Lim', 'Hughes'];

const NOTIFICATION_SPECS: { title: string; description: (c: string) => string; roles: string[] }[] = [
  { title: 'Step submitted for review', description: (c) => `${c}: Registered office details were submitted.`, roles: ['manager', 'admin', 'super_admin'] },
  { title: 'Approval needed', description: (c) => `${c}: Board resolution is waiting for your approval.`, roles: ['manager', 'admin'] },
  { title: 'New document uploaded', description: (c) => `${c}: Client uploaded the utility bill for the registered office.`, roles: ['intern', 'manager'] },
  { title: 'Task assigned to you', description: (c) => `${c}: Prepare the DIR-2 consent for each director.`, roles: ['intern'] },
  { title: 'Filing due in 7 days', description: (c) => `${c}: GSTR-3B for this month is due next week.`, roles: ['intern', 'manager', 'client', 'admin'] },
  { title: 'Filing overdue', description: (c) => `${c}: TDS return (24Q) has passed its due date.`, roles: ['manager', 'admin', 'client', 'super_admin'] },
  { title: 'Documents requested', description: (c) => `${c}: SBC asked for 3 documents. Open Documents to upload them.`, roles: ['client'] },
  { title: 'Step approved', description: (c) => `${c}: Capital structure was approved by your project manager.`, roles: ['client', 'intern'] },
  { title: 'Timeline change requested', description: (c) => `${c}: The client asked to move the incorporation window.`, roles: ['manager', 'intern'] },
  { title: 'Project change request', description: (c) => `${c}: A manager asked to reassign the project manager.`, roles: ['admin', 'super_admin'] },
  { title: 'New announcement', description: () => 'MCA extends the due date for AOC-4 and MGT-7.', roles: ['client', 'intern', 'manager', 'admin'] },
  { title: 'Certificate of Incorporation issued', description: (c) => `${c}: The COI, PAN and TAN are now in your documents.`, roles: ['client', 'manager', 'admin'] },
];
const NOTIFICATION_TITLES = NOTIFICATION_SPECS.map((n) => n.title);

const REQUEST_SPECS: { title: string; detail: string; kind: 'upload' | 'fill' | 'correct' | 'sign'; stepId: string; fieldId?: string }[] = [
  { title: 'Utility bill for registered office', detail: 'Electricity or water bill, not older than 2 months, in the owner’s name.', kind: 'upload', stepId: 'pre-14', fieldId: 'registeredOfficeUtilityBillCopyUrl' },
  { title: 'NOC from property owner', detail: 'Signed no-objection letter on plain paper with the owner’s ID proof.', kind: 'sign', stepId: 'pre-14', fieldId: 'registeredOfficeNocUrl' },
  { title: 'Passport copy — director', detail: 'Colour scan of the front and back pages, apostilled for foreign nationals.', kind: 'upload', stepId: 'pre-15' },
  { title: 'Proof of address — director', detail: 'Bank statement or utility bill not older than 2 months.', kind: 'upload', stepId: 'pre-15' },
  { title: 'Confirm authorised share capital', detail: 'Tell us the authorised and paid-up capital you want to start with.', kind: 'fill', stepId: 'pre-13' },
  { title: 'Correct director’s father’s name', detail: 'The name on the PAN and the passport do not match. Please confirm the right spelling.', kind: 'correct', stepId: 'pre-15' },
  { title: 'Parent board resolution (signed)', detail: 'Print, sign on letterhead and upload the board resolution we shared.', kind: 'sign', stepId: 'pre-1' },
  { title: 'Bank statement for GST', detail: 'First page of the current account statement or a cancelled cheque.', kind: 'upload', stepId: 'reg-4' },
];

const WORK_ITEM_SPECS: { title: string; stepId: string }[] = [
  { title: 'Drafting MOA and AOA', stepId: 'pre-7' },
  { title: 'Preparing SPICe+ Part B', stepId: 'pre-9' },
  { title: 'Name reservation (RUN) filing', stepId: 'pre-2' },
  { title: 'GST registration application', stepId: 'reg-4' },
  { title: 'Opening the current account with HDFC', stepId: 'reg-2' },
  { title: 'Professional Tax enrolment', stepId: 'reg-6' },
  { title: 'Monthly bookkeeping close', stepId: 'post-3' },
];

const ANNOUNCEMENT_SPECS: { title: string; body: string; kind: string; daysAgo: number }[] = [
  { title: 'MCA extends due date for AOC-4 and MGT-7', body: 'The Ministry of Corporate Affairs has extended the due date for filing AOC-4 and MGT-7 for FY 2025-26 by 30 days without additional fees. We will file on your behalf before the new date.', kind: 'mca', daysAgo: 1 },
  { title: 'GST: new invoice management system from next month', body: 'GSTN is moving all taxpayers to the Invoice Management System (IMS). Suppliers’ invoices must be accepted, rejected or kept pending before GSTR-3B. Your lead will walk you through the change.', kind: 'gst', daysAgo: 3 },
  { title: 'Advance tax: third instalment due 15 December', body: '75% of the estimated tax for the year must be paid by 15 December. Send us your provisional numbers by 5 December so we can compute it.', kind: 'tax', daysAgo: 6 },
  { title: 'Office closed for Diwali', body: 'Our offices will be closed on 20 and 21 October. Filings due in that window are already scheduled.', kind: 'general', daysAgo: 8 },
  { title: 'Faster incorporation: SPICe+ now shows live status', body: 'MCA V3 shows SRN status in near real time. You will see the latest status on your Incorporation page as soon as we record it.', kind: 'incorp', daysAgo: 12 },
  { title: 'DIR-3 KYC window open', body: 'Every director with a DIN must file DIR-3 KYC by 30 September. We have pre-filled the forms; directors only need to verify the OTPs.', kind: 'deadline', daysAgo: 20 },
  { title: 'New: Credentials vault in your portal', body: 'All your portal logins and registration numbers now live in one place, protected by an OTP. Open Credentials from the sidebar.', kind: 'post-incorp', daysAgo: 25 },
  { title: 'Shops and Establishment renewals', body: 'Karnataka S&E registrations issued before 2021 need renewal this year. We will reach out to affected companies.', kind: 'reg', daysAgo: 33 },
  { title: 'TDS: higher rate for non-filers removed', body: 'Section 206AB has been withdrawn. Vendor payments no longer need the specified-person check.', kind: 'compliance', daysAgo: 41 },
];

const KB_TREE: { folder: string; children?: string[]; files: { title: string; fileName: string; description: string }[] }[] = [
  {
    folder: 'Incorporation',
    children: ['Templates', 'MCA circulars'],
    files: [
      { title: 'SPICe+ checklist', fileName: 'spice-plus-checklist.pdf', description: 'Every document and field SPICe+ Part A and B ask for.' },
      { title: 'Name approval guide', fileName: 'run-name-rules.pdf', description: 'Rules of the Companies (Incorporation) Rules for names, with examples.' },
    ],
  },
  {
    folder: 'GST',
    files: [
      { title: 'GST registration SOP', fileName: 'gst-registration-sop.pdf', description: 'Step-by-step REG-01 filing with screenshots.' },
      { title: 'GSTR-3B reconciliation sheet', fileName: 'gstr3b-recon.xlsx', description: 'Template to reconcile 2B with books.' },
    ],
  },
  {
    folder: 'Payroll and labour',
    files: [
      { title: 'PF and ESI thresholds 2026', fileName: 'pf-esi-thresholds.pdf', description: 'Wage ceilings and contribution rates.' },
      { title: 'Professional Tax by state', fileName: 'pt-slabs-by-state.pdf', description: 'Slabs and due dates for every PT state.' },
    ],
  },
  {
    folder: 'FEMA and RBI',
    files: [
      { title: 'FC-GPR filing guide', fileName: 'fc-gpr-guide.pdf', description: 'Reporting foreign investment within 30 days of allotment.' },
      { title: 'Annual FLA return', fileName: 'fla-return-notes.pdf', description: 'Who must file FLA and by when.' },
    ],
  },
];

const CHANGE_REQUEST_REASONS = [
  'I am moving to the GCC team next month. Leena knows this client well.',
  'Client asked for a manager in their time zone.',
  'Balancing workload across the team for Q4.',
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function directorEntries(project: DemoProject, index: number) {
  const foreign = project.slug !== 'demo-meridian-health' && project.slug !== 'demo-quarry-digital';
  const people = [
    {
      firstName: foreign ? pick(FOREIGN_FIRST, index) : pick(FIRST, index),
      lastName: foreign ? pick(FOREIGN_LAST, index) : pick(LAST, index),
      indiaResident: foreign ? 'no' : 'yes',
      nationality: foreign ? 'Foreign' : 'Indian',
      gender: index % 2 === 0 ? 'male' : 'female',
    },
    {
      firstName: pick(FIRST, index + 3),
      lastName: pick(LAST, index + 5),
      indiaResident: 'yes',
      nationality: 'Indian',
      gender: index % 2 === 0 ? 'female' : 'male',
    },
  ];
  const responses: Record<string, string> = {};
  const ids: string[] = [];
  people.forEach((p, i) => {
    const id = `edemo${index}${i}`;
    ids.push(id);
    const set = (field: string, value: string) => {
      responses[`directors.${id}.${field}`] = value;
    };
    set('firstName', p.firstName);
    set('lastName', p.lastName);
    set('gender', p.gender);
    set('indiaResident', p.indiaResident);
    set('nationality', p.nationality);
    set('din', project.done > 12 ? String(10_400_000 + index * 31 + i) : '');
    set('hasDsc', 'yes');
    set('dscExpiryDate', ymd(daysAhead(300 + index * 10)));
    set('dob', `19${78 + ((index + i) % 15)}-0${(i % 8) + 1}-1${index % 9}`);
    set('fatherName', `${pick(FIRST, index + i + 7)} ${p.lastName}`);
    set('highestEducationalQualification', i === 0 ? 'Post graduate' : 'Graduate');
    set('occupationType', 'Business');
    set('mobileNumber', `98${String(45_000_000 + index * 977 + i * 13).padStart(8, '0')}`);
    set('personalMailId', `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@example.com`);
    set('panNumber', p.indiaResident === 'yes' ? `ABCP${String.fromCharCode(65 + index)}${1200 + index * 7 + i}K` : '');
    set('passportNumber', p.indiaResident === 'no' ? `X${7_100_000 + index * 11 + i}` : '');
    set('aadhaarNumber', p.indiaResident === 'yes' ? `5${String(10_000_000_000 + index * 7_777 + i).slice(0, 11)}` : '');
  });
  responses.directors = ids.join(',');
  return responses;
}

function scheduleFor(project: DemoProject, setBy: string) {
  const start = daysAgo(project.startedDaysAgo);
  const from = ymd(start);
  const to = ymd(new Date(start.getTime() + 75 * DAY));
  return { incorporation: { from, to, setBy, setAt: start.toISOString() } };
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

export async function seedDemoExtras(
  projects: DemoProject[],
  ids: Map<string, string>,
  people: DemoPerson[],
): Promise<void> {
  const nameOf = (key: string) => people.find((p) => p.key === key)?.name ?? key;
  const seeded = new Map(
    (await db.select({ id: profiles.id, email: profiles.email }).from(profiles).where(inArray(profiles.email, SEED_LOGINS))).map(
      (row) => [row.email, row.id],
    ),
  );

  /* ---- Directors, schedule, questionnaire on each project ---- */
  console.log('\nFilling directors and schedules…');
  for (const [i, project] of projects.entries()) {
    const [row] = await db.select({ checklistState: engagements.checklistState }).from(engagements).where(eq(engagements.id, project.id));
    const state = { ...((row?.checklistState ?? {}) as Record<string, Record<string, unknown>>) };
    const pre15 = state['pre-15'] ?? { status: project.done > 0 ? 'in-progress' : 'not-started' };
    state['pre-15'] = {
      ...pre15,
      responses: { ...((pre15.responses as Record<string, string>) ?? {}), ...directorEntries(project, i) },
    };
    const pre13 = state['pre-13'] ?? { status: 'not-started' };
    state['pre-13'] = {
      ...pre13,
      responses: {
        ...((pre13.responses as Record<string, string>) ?? {}),
        authorisedShareCapital: String(1_000_000 * ((i % 3) + 1)),
        paidUpShareCapital: String(100_000 * ((i % 5) + 1)),
        nominalValuePerEquityShare: '10',
      },
    };
    await db
      .update(engagements)
      .set({
        checklistState: state,
        schedule: scheduleFor(project, ids.get(project.managerKey)!),
        parentEntityAddress: project.slug.includes('meridian') || project.slug.includes('quarry') ? null : '1209 Orange Street, Wilmington, DE 19801',
      })
      .where(eq(engagements.id, project.id));
  }

  /* ---- Seed logins join a few projects so they are not empty ---- */
  console.log('Linking the @vcfo.local seed logins to demo projects…');
  const managerSeed = seeded.get('manager@vcfo.local');
  const clientSeed = seeded.get('client@vcfo.local');
  for (const [i, project] of projects.entries()) {
    if (managerSeed && i % 3 === 0) {
      await db.insert(engagementManagers).values({ engagementId: project.id, managerId: managerSeed }).onConflictDoNothing();
    }
    if (seeded.get('intern@vcfo.local') && i % 4 === 1) {
      await db.insert(engagementLeads).values({ engagementId: project.id, internId: 'intern-1' }).onConflictDoNothing();
    }
    if (clientSeed && (project.slug === 'demo-halcyon-payments' || project.slug === 'demo-kestrel-robotics')) {
      await db.insert(engagementClients).values({ engagementId: project.id, userId: clientSeed, memberRole: 'member' }).onConflictDoNothing();
    }
  }

  /* ---- Client team: two colleagues per project, one pending invite ---- */
  console.log('Creating client team members and invites…');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const tempHash = await bcrypt.hash('temp-Invite-2026', 10);
  const clientTeam = new Map<string, string[]>();
  for (const [i, project] of projects.entries()) {
    const org = project.slug.replace('demo-', '').split('-')[0]!;
    const members: string[] = [];
    for (let m = 0; m < 2; m += 1) {
      const first = pick(FIRST, i + m * 4);
      const last = pick(LAST, i * 2 + m);
      const email = `${org}-${first.toLowerCase()}${DEMO_EMAIL_DOMAIN}`;
      const pending = m === 1;
      const [person] = await db
        .insert(profiles)
        .values({
          email,
          passwordHash: pending ? tempHash : passwordHash,
          name: `${first} ${last}`,
          role: 'client',
          clientId: project.clientScopeId,
          phoneE164: `+9198${String(80_000_000 + i * 101 + m).padStart(8, '0')}`,
        })
        .onConflictDoNothing()
        .returning({ id: profiles.id });
      if (!person) continue;
      members.push(person.id);
      await db.insert(engagementClients).values({
        engagementId: project.id,
        userId: person.id,
        memberRole: 'member',
        invitedBy: ids.get(project.clientKey)!,
        createdAt: daysAgo(Math.max(1, project.startedDaysAgo - 5 - m)),
      });
      await db.insert(clientInvites).values({
        engagementId: project.id,
        email,
        name: `${first} ${last}`,
        profileId: person.id,
        invitedBy: ids.get(project.clientKey)!,
        tempPasswordHash: pending ? tempHash : passwordHash,
        sendCount: pending ? 2 : 1,
        lastSentAt: daysAgo(pending ? 2 : project.startedDaysAgo - 5),
        acceptedAt: pending ? null : daysAgo(Math.max(1, project.startedDaysAgo - 6)),
        createdAt: daysAgo(Math.max(1, project.startedDaysAgo - 5 - m)),
      });
    }
    clientTeam.set(project.id, members);
    await db.insert(invites).values({
      token: `demo-${project.slug}-${i}`,
      email: `finance@${org}.example.com`,
      role: 'client',
      engagementId: project.id,
      expiresAt: daysAhead(10),
      createdAt: daysAgo(3),
    });
  }

  /* ---- Document requests + need meta + uploaded files ---- */
  console.log('Creating document requests…');
  let requestCount = 0;
  const requestPlaceholders: Array<{ key: string; title: string }> = [];
  for (const [i, project] of projects.entries()) {
    const requester = project.leadKey ? ids.get(project.leadKey)! : ids.get(project.managerKey)!;
    const count = 3 + (i % 4);
    for (let r = 0; r < count; r += 1) {
      const spec = pick(REQUEST_SPECS, i + r);
      // First requests are older and mostly answered; the latest ones are open.
      const status = r === 0 ? 'approved' : r === 1 ? 'fulfilled' : r === count - 1 && i % 3 === 0 ? 'cancelled' : 'pending';
      const created = daysAgo(Math.max(1, 20 - r * 4 + (i % 3)));
      const [req] = await db
        .insert(documentRequests)
        .values({ engagementId: project.id, requestedBy: requester, title: spec.title, detail: spec.detail, status, createdAt: created })
        .returning({ id: documentRequests.id });
      const due = ymd(r === 2 && i % 2 === 0 ? daysAgo(2) : daysAhead(3 + r * 2));
      await db.insert(clientNeedMeta).values({
        requestId: req!.id,
        engagementId: project.id,
        stepId: spec.stepId,
        kind: spec.kind,
        dueDate: due,
        fieldId: spec.fieldId ?? null,
      });
      await db.insert(documentRequestDetails).values({
        requestId: req!.id,
        engagementId: project.id,
        dueOn: due,
        stepId: spec.stepId,
        fieldId: spec.fieldId ?? null,
        reviewNote: status === 'approved' ? 'Looks good, thank you.' : null,
        reviewNoteBy: status === 'approved' ? requester : null,
      });
      if (status === 'approved' || status === 'fulfilled') {
        const fileName = `${spec.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
        const objectKey = `demo/${project.slug}/requests/${req!.id}/${fileName}`;
        // Request files are read at their object key as stored (no bucket prefix).
        requestPlaceholders.push({ key: objectKey, title: `${project.companyName}: ${spec.title}` });
        await db.insert(documentRequestFiles).values({
          requestId: req!.id,
          engagementId: project.id,
          objectKey,
          fileName,
          contentType: 'application/pdf',
          sizeBytes: 220_000 + r * 31_000,
          uploadedBy: ids.get(project.clientKey)!,
          uploadedAt: new Date(created.getTime() + 2 * DAY),
        });
      }
      requestCount += 1;
    }
  }
  console.log(`  ${requestCount} request(s)`);
  const storedRequests = await seedPlaceholders(requestPlaceholders);
  console.log(`  ${storedRequests.uploaded} request placeholder file(s) uploaded, ${storedRequests.existing} already in storage`);
  if (storedRequests.failed) console.warn(`  storage not reachable, request placeholders skipped: ${storedRequests.failed}`);

  /* ---- Step-level file requests (staff → client) ---- */
  let fileRequestCount = 0;
  for (const [i, project] of projects.entries()) {
    if (project.done === 0) continue;
    const requester = project.leadKey ? ids.get(project.leadKey)! : ids.get(project.managerKey)!;
    const rows = [
      { stepId: 'pre-14', fieldId: 'registeredOfficeUtilityBillCopyUrl', label: 'Utility bill (registered office)', fulfilled: i % 2 === 0 },
      { stepId: 'pre-14', fieldId: 'registeredOfficeNocUrl', label: 'NOC from the property owner', fulfilled: false },
    ];
    for (const row of rows) {
      await db.insert(clientFileRequests).values({
        engagementId: project.id,
        stepId: row.stepId,
        fieldId: row.fieldId,
        label: row.label,
        note: 'Please upload a clear scan. Phone photos are fine if all four corners are visible.',
        dueDate: ymd(daysAhead(4 + i)),
        requestedBy: requester,
        requestedAt: daysAgo(6),
        fulfilledAt: row.fulfilled ? daysAgo(2) : null,
        fulfilledBy: row.fulfilled ? ids.get(project.clientKey)! : null,
        fulfilledPath: row.fulfilled ? `demo/${project.slug}/${row.fieldId}.pdf` : null,
        fileName: row.fulfilled ? `${row.fieldId}.pdf` : null,
        sizeBytes: row.fulfilled ? 310_000 : null,
        contentType: row.fulfilled ? 'application/pdf' : null,
      });
      fileRequestCount += 1;
    }
  }
  console.log(`  ${fileRequestCount} step file request(s)`);

  /* ---- What SBC is doing ---- */
  console.log('Creating work items, timeline and change requests…');
  for (const [i, project] of projects.entries()) {
    const assignee = project.leadKey ? ids.get(project.leadKey)! : ids.get(project.managerKey)!;
    for (let w = 0; w < 3; w += 1) {
      const spec = pick(WORK_ITEM_SPECS, i + w);
      const status = w === 0 && project.done > 5 ? 'done' : 'active';
      await db.insert(clientWorkItems).values({
        engagementId: project.id,
        stepId: spec.stepId,
        title: spec.title,
        assigneeId: assignee,
        progressPct: status === 'done' ? 100 : 20 + ((i * 17 + w * 23) % 70),
        readyOn: ymd(daysAhead(2 + w * 4 + (i % 3))),
        status,
        createdBy: ids.get(project.managerKey)!,
        createdAt: daysAgo(10 - w),
      });
    }
  }

  /* ---- Timeline change requests from clients (pre-incorporation only) ---- */
  const preInc = projects.filter((p) => p.stage === 'Pre-Incorporation' && p.done > 0);
  for (const [i, project] of preInc.entries()) {
    const start = daysAgo(project.startedDaysAgo);
    const at = (n: number) => ymd(new Date(start.getTime() + n * DAY));
    const slip = 7 + i * 3;
    const [task] = await db
      .insert(tasks)
      .values({
        engagementId: project.id,
        assignedTo: project.leadKey ? ids.get(project.leadKey)! : null,
        title: 'Review client timeline change',
        description: 'The client asked to move the incorporation window. Check the impact before the manager decides.',
        status: 'open',
        deadline: daysAhead(2),
      })
      .returning({ id: tasks.id });
    await db.insert(clientTimelineRequests).values({
      engagementId: project.id,
      taskId: task!.id,
      requestedBy: ids.get(project.clientKey)!,
      requestedByName: nameOf(project.clientKey),
      reason: pick(
        [
          'Our directors are travelling until the end of the month and cannot sign earlier.',
          'Waiting for the parent board meeting to approve the capital.',
          'Apostille of the passports is taking longer than expected.',
        ],
        i,
      ),
      payload: {
        phases: [
          { id: 'p1', name: 'Part A', from: at(0), to: at(20 + slip) },
          { id: 'p2', name: 'Part B', from: at(21 + slip), to: at(50 + slip) },
          { id: 'mca', name: 'MCA review', from: at(51 + slip), to: at(65 + slip) },
          { id: 'coi', name: 'Certificate of Incorporation', from: at(66 + slip), to: at(75 + slip) },
        ],
        coiFrom: at(66 + slip),
        coiTo: at(75 + slip),
        slipDays: slip,
      },
      status: i === preInc.length - 1 ? 'rejected' : 'pending',
      decidedBy: i === preInc.length - 1 ? ids.get(project.managerKey)! : null,
      decidedAt: i === preInc.length - 1 ? daysAgo(1) : null,
      decisionNote: i === preInc.length - 1 ? 'We can keep the original dates. DSCs are ready.' : null,
      createdAt: daysAgo(2 + i),
    });
  }

  /* ---- Manager → admin change requests ---- */
  const managerKeys = [...new Set(projects.map((p) => p.managerKey))];
  for (const [i, project] of projects.slice(0, 3).entries()) {
    const nextManager = managerKeys.find((k) => k !== project.managerKey)!;
    await db.insert(engagementChangeRequests).values({
      engagementId: project.id,
      kind: 'change_manager',
      status: i === 2 ? 'rejected' : 'pending',
      requestedBy: ids.get(project.managerKey)!,
      requestedByName: nameOf(project.managerKey),
      reason: pick(CHANGE_REQUEST_REASONS, i),
      payload: { managerId: ids.get(nextManager)! },
      preview: { from: nameOf(project.managerKey), to: nameOf(nextManager) },
      decidedBy: i === 2 ? ids.get('admin-nadia') ?? null : null,
      decidedByName: i === 2 ? nameOf('admin-nadia') : null,
      decidedAt: i === 2 ? daysAgo(1) : null,
      decisionNote: i === 2 ? 'Keep it as is until the COI is out.' : null,
      createdAt: daysAgo(3 + i),
    });
  }

  /* ---- Compliance: proofs, filing details, reminders ---- */
  console.log('Adding filing proofs, details and reminders…');
  const instances = await db
    .select({
      id: complianceInstances.id,
      engagementId: complianceInstances.engagementId,
      status: complianceInstances.status,
      dueDate: complianceInstances.dueDate,
      obligationId: complianceInstances.obligationId,
    })
    .from(complianceInstances)
    .where(inArray(complianceInstances.engagementId, projects.map((p) => p.id)));
  const today = ymd(new Date());
  let proofCount = 0;
  for (const [i, instance] of instances.entries()) {
    const project = projects.find((p) => p.id === instance.engagementId)!;
    const staff = project.leadKey ? ids.get(project.leadKey)! : ids.get(project.managerKey)!;
    if (instance.status === 'filed') {
      await db.insert(complianceInstanceProofs).values({
        instanceId: instance.id,
        engagementId: instance.engagementId,
        storagePath: `demo/${project.slug}/filings/${instance.id}.pdf`,
        fileName: `${instance.obligationId}-acknowledgement.pdf`,
        mime: 'application/pdf',
        sizeBytes: 95_000 + (i % 7) * 4_000,
        kind: 'acknowledgement',
        isPrimary: true,
        uploadedBy: staff,
        uploadedAt: new Date(`${instance.dueDate}T10:00:00Z`),
      });
      await db
        .insert(complianceInstanceDetails)
        .values({
          instanceId: instance.id,
          acknowledgementNo: `ACK${String(400_000_000 + i * 7_919).slice(0, 12)}`,
          amountPaid: String((i % 4) * 2_500),
          filedBy: staff,
          dataReceivedOn: ymd(new Date(new Date(instance.dueDate).getTime() - 8 * DAY)),
          approvedOn: ymd(new Date(new Date(instance.dueDate).getTime() - 2 * DAY)),
          updatedBy: staff,
        })
        .onConflictDoNothing();
      proofCount += 1;
    } else if (instance.dueDate >= today && i % 3 === 0) {
      // Upcoming filings in preparation, so the Filings register shows progress.
      await db
        .insert(complianceInstanceDetails)
        .values({
          instanceId: instance.id,
          dataReceivedOn: ymd(daysAgo(3)),
          preparingSince: ymd(daysAgo(2)),
          draftDueOn: ymd(daysAhead(2)),
          approvalDueOn: ymd(daysAhead(4)),
          updatedBy: staff,
        })
        .onConflictDoNothing();
      const clientId = ids.get(project.clientKey)!;
      const remindOn = new Date(new Date(instance.dueDate).getTime() - 3 * DAY);
      if (remindOn > new Date()) {
        await db
          .insert(complianceReminders)
          .values({ instanceId: instance.id, userId: clientId, remindOn: ymd(remindOn), channels: ['email', 'whatsapp'] })
          .onConflictDoNothing();
      }
    }
  }
  console.log(`  ${proofCount} proof(s)`);

  /* ---- Credentials vault: login and registration rows for incorporated companies ---- */
  console.log('Filling credentials…');
  const incorporated = projects.filter((p) => p.incorporatedDaysAgo != null || p.stage !== 'Pre-Incorporation');
  for (const [i, project] of incorporated.entries()) {
    const org = project.slug.replace('demo-', '').split('-')[0]!;
    const updatedBy = project.leadKey ? ids.get(project.leadKey)! : ids.get(project.managerKey)!;
    const rows: { sheet: string; rowKey: string; ordinal: number; fields: Record<string, string>; secrets: Record<string, string> }[] = [
      { sheet: 'login', rowKey: 'gst', ordinal: 7, fields: { mail: `accounts@${org}.example.com`, status: 'Active' }, secrets: { id: `${org}gst01`, password: 'Gst@2026demo', mobile: '9845012345' } },
      { sheet: 'login', rowKey: 'pf', ordinal: 6, fields: { mail: `hr@${org}.example.com`, status: 'Active' }, secrets: { id: `KN/BNG/${2_400_000 + i}`, password: 'Epfo#demo1', mobile: '9845012345' } },
      { sheet: 'login', rowKey: 'esi', ordinal: 5, fields: { mail: `hr@${org}.example.com`, status: 'Pending' }, secrets: { id: `5300${120_000 + i}`, password: 'Esic#demo1' } },
      { sheet: 'login', rowKey: 'bank', ordinal: 10, fields: { mail: `finance@${org}.example.com`, status: 'Active' }, secrets: { id: `${org.toUpperCase()}CORP`, password: 'Hdfc!demo2026' } },
      { sheet: 'login', rowKey: 'zoho', ordinal: 20, fields: { mail: `books@${org}.example.com`, status: 'Active' }, secrets: { id: `books@${org}.example.com`, password: 'Zoho*demo' } },
      { sheet: 'login', rowKey: 'mca-v3', ordinal: 24, fields: { mail: `cs@${org}.example.com`, status: 'Active' }, secrets: { id: `${org}_mca`, password: 'Mca@demo26' } },
      { sheet: 'reg', rowKey: 'gst', ordinal: 1, fields: { number: `29AAB${String.fromCharCode(67 + i)}A${1000 + i}K1Z${i}`, date: ymd(daysAgo(40 + i * 5)) }, secrets: { login: `${org}gst01`, password: 'Gst@2026demo' } },
      { sheet: 'reg', rowKey: 'pf', ordinal: 2, fields: { number: `KNBNG${2_400_000 + i}000`, date: ymd(daysAgo(35 + i * 4)) }, secrets: {} },
      { sheet: 'reg', rowKey: 'pt', ordinal: 4, fields: { number: `PTEC${310_000 + i}`, date: ymd(daysAgo(30 + i * 3)) }, secrets: {} },
      { sheet: 'reg', rowKey: 'iec', ordinal: 8, fields: { number: `AAB${String.fromCharCode(67 + i)}A${1000 + i}K`, date: ymd(daysAgo(25 + i)) }, secrets: {} },
      { sheet: 'reg', rowKey: 'lut', ordinal: 9, fields: { number: `AD29${String(26_000 + i * 37)}`, date: ymd(daysAgo(20 + i)) }, secrets: {} },
      { sheet: 'address', rowKey: 'registered', ordinal: 0, fields: { door: `${12 + i}`, building: 'Prestige Central', street: 'Infantry Road', area: 'Shivajinagar', city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', pin: '560001', country: 'India', ownership: 'Rented', owner: 'Prestige Estates Ltd' }, secrets: {} },
      { sheet: 'other', rowKey: 'other-1', ordinal: 0, fields: { label: 'Company LinkedIn page', email: `marketing@${org}.example.com` }, secrets: { id: `${org}-india`, password: 'Li#demo2026' } },
    ];
    for (const row of rows) {
      await db.insert(engagementCredentials).values({
        engagementId: project.id,
        sheet: row.sheet,
        rowKey: row.rowKey,
        ordinal: row.ordinal,
        fields: row.fields,
        secretCiphertext: encryptSecrets(row.secrets, `${project.id}|${row.sheet}|${row.rowKey}`),
        edited: Object.fromEntries([...Object.keys(row.fields), ...Object.keys(row.secrets)].map((k) => [k, true])),
        updatedBy,
        updatedAt: daysAgo(4 + i),
      });
    }
  }
  console.log(`  ${incorporated.length} vault(s)`);

  /* ---- Activity feed ---- */
  const ACTIVITY = [
    { kind: 'step', message: 'submitted Registered office address for review' },
    { kind: 'document', message: 'uploaded the signed NOC' },
    { kind: 'comment', message: 'asked for a clearer passport scan' },
    { kind: 'step', message: 'approved Capital structure' },
    { kind: 'filing', message: 'filed GSTR-1 for last month' },
    { kind: 'request', message: 'requested 2 documents from the client' },
  ];
  for (const [i, project] of projects.entries()) {
    const actors = [project.leadKey, project.managerKey, project.clientKey].filter(Boolean) as string[];
    for (let a = 0; a < 6; a += 1) {
      const actorKey = pick(actors, i + a);
      const entry = pick(ACTIVITY, i + a);
      await db.insert(activity).values({
        engagementId: project.id,
        actorId: ids.get(actorKey)!,
        kind: entry.kind,
        message: `${nameOf(actorKey)} ${entry.message}`,
        createdAt: daysAgo(a * 2 + (i % 3)),
      });
    }
  }

  /* ---- Notifications for every demo person and seed login ---- */
  console.log('Creating notifications…');
  const recipients: { id: string; role: string; projects: DemoProject[] }[] = [];
  for (const person of people) {
    const id = ids.get(person.key);
    if (!id) continue;
    const mine = projects.filter(
      (p) => p.leadKey === person.key || p.managerKey === person.key || p.clientKey === person.key || person.role === 'admin',
    );
    recipients.push({ id, role: person.role, projects: mine.length > 0 ? mine : projects });
  }
  const seededRoles: Record<string, string> = {
    'super@vcfo.local': 'super_admin',
    'admin@vcfo.local': 'admin',
    'manager@vcfo.local': 'manager',
    'intern@vcfo.local': 'intern',
    'client@vcfo.local': 'client',
  };
  for (const [email, id] of seeded) recipients.push({ id, role: seededRoles[email]!, projects });
  for (const [projectId, members] of clientTeam) {
    const project = projects.find((p) => p.id === projectId)!;
    for (const id of members) recipients.push({ id, role: 'client', projects: [project] });
  }

  let notificationCount = 0;
  for (const [r, recipient] of recipients.entries()) {
    const specs = NOTIFICATION_SPECS.filter((n) => n.roles.includes(recipient.role));
    for (const [n, spec] of specs.entries()) {
      const project = pick(recipient.projects, r + n);
      await db.insert(notifications).values({
        userId: recipient.id,
        title: spec.title,
        description: spec.description(project.companyName),
        status: n < 3 ? 'unread' : 'read',
        createdAt: new Date(Date.now() - (n * 7 + (r % 5)) * 3_600_000),
      });
      notificationCount += 1;
    }
  }
  console.log(`  ${notificationCount} notification(s)`);

  /* ---- Portal settings for clients ---- */
  for (const recipient of recipients.filter((x) => x.role === 'client')) {
    await db
      .insert(notificationPrefs)
      .values({
        profileId: recipient.id,
        email: { announcements: true, feed: true, weeklyDigest: recipient.id.charCodeAt(0) % 2 === 0 },
        whatsapp: { docs: true, steps: true, deadlines: true, timeline: false, announcements: false, feed: false },
      })
      .onConflictDoNothing();
    await db.insert(clientAccountMeta).values({ profileId: recipient.id, passwordChangedAt: daysAgo(45) }).onConflictDoNothing();
  }

  /* ---- Announcements (+ a few read marks) ---- */
  console.log('Publishing announcements…');
  const author = ids.get('admin-nadia')!;
  const announcementIds: string[] = [];
  for (const [i, spec] of ANNOUNCEMENT_SPECS.entries()) {
    const [row] = await db
      .insert(announcements)
      .values({
        title: spec.title,
        body: spec.body,
        origin: 'manual',
        kind: spec.kind,
        externalId: `${DEMO_TAG}-${i}`,
        authorId: author,
        authorName: nameOf('admin-nadia'),
        authorRole: 'admin',
        publishedAt: daysAgo(spec.daysAgo),
        createdAt: daysAgo(spec.daysAgo),
      })
      .returning({ id: announcements.id });
    announcementIds.push(row!.id);
  }
  for (const recipient of recipients.filter((x) => x.role === 'client')) {
    for (const id of announcementIds.slice(3)) {
      await db.insert(announcementReads).values({ profileId: recipient.id, announcementId: id }).onConflictDoNothing();
    }
  }

  /* ---- Knowledge bank ---- */
  console.log('Filling the knowledge bank…');
  const kbOwner = ids.get('pm-anita') ?? author;
  let kbFiles = 0;
  for (const [f, node] of KB_TREE.entries()) {
    const [folder] = await db
      .insert(knowledgeBankFolders)
      .values({ name: node.folder, createdBy: kbOwner, createdAt: daysAgo(60 - f) })
      .returning({ id: knowledgeBankFolders.id });
    for (const child of node.children ?? []) {
      await db.insert(knowledgeBankFolders).values({ name: child, parentId: folder!.id, createdBy: kbOwner });
    }
    for (const [i, file] of node.files.entries()) {
      await db.insert(knowledgeBankFiles).values({
        title: file.title,
        description: file.description,
        storagePath: `demo/knowledge-bank/${f}-${i}-${file.fileName}`,
        fileName: file.fileName,
        mimeType: file.fileName.endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
        sizeBytes: 140_000 + i * 60_000,
        uploadedBy: kbOwner,
        folderId: folder!.id,
        createdAt: daysAgo(50 - f * 3 - i),
      });
      kbFiles += 1;
    }
  }
  console.log(`  ${KB_TREE.length} folder(s), ${kbFiles} file(s)`);
}
