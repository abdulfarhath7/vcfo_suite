/**
 * Demo data seed — fills a LOCAL database so the dashboards have something to
 * show: staff and client accounts, ten projects spread across every stage and
 * health state, checklist progress, documents, audit trail, tasks, and real
 * generated compliance filings.
 *
 *   npm run db:seed-demo
 *
 * Scope and safety:
 *   - Everything it creates is tagged: profiles on `@demo.vcfo.local`,
 *     engagements with a `demo-` slug prefix.
 *   - Re-running DELETES only those tagged rows and rebuilds them. Real data —
 *     any project or account you created yourself — is never touched.
 *   - `npm run db:purge-demo` also removes all of it (it keeps only the four
 *     `@vcfo.local` seed logins).
 *
 * This is DEV DATABASE seed data, not UI placeholder data: every screen still
 * reads it live through the repository layer, so what you see is the real
 * pipeline running over demo rows.
 */
import './load-env';

import bcrypt from 'bcryptjs';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  auditEvents,
  complianceInstances,
  documents,
  engagementClients,
  engagementLeads,
  engagementManagers,
  engagements,
  profiles,
  tasks,
} from '../src/db/schema';
import { getActiveCatalogItems } from '../src/data/checklist';
import { systemGenerateComplianceInstances } from '../src/db/repositories/compliance';
import type { ChecklistItemStateSlice } from '../src/lib/checklist-state-key';

const DEMO_EMAIL_DOMAIN = '@demo.vcfo.local';
const DEMO_SLUG_PREFIX = 'demo-';
const DEMO_PASSWORD = 'demo1234';

const CATALOG = getActiveCatalogItems();

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length]!;
}

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

type PersonSpec = {
  key: string;
  name: string;
  role: 'admin' | 'manager' | 'intern' | 'client';
  /** Scoping key for leads; org key for clients. */
  scopeId?: string;
  reportsTo?: string;
};

const ADMINS: PersonSpec[] = [
  { key: 'admin-nadia', name: 'Nadia Fernandes', role: 'admin' },
  { key: 'admin-vikram', name: 'Vikram Rao', role: 'admin' },
];

const MANAGERS: PersonSpec[] = [
  { key: 'pm-anita', name: 'Anita Desai', role: 'manager' },
  { key: 'pm-joseph', name: 'Joseph Mathew', role: 'manager' },
  { key: 'pm-leena', name: 'Leena Krishnan', role: 'manager' },
];

const LEADS: PersonSpec[] = [
  { key: 'lead-arjun', name: 'Arjun Mehta', role: 'intern', scopeId: 'demo-lead-arjun', reportsTo: 'pm-anita' },
  { key: 'lead-divya', name: 'Divya Nair', role: 'intern', scopeId: 'demo-lead-divya', reportsTo: 'pm-anita' },
  { key: 'lead-rohan', name: 'Rohan Iyer', role: 'intern', scopeId: 'demo-lead-rohan', reportsTo: 'pm-joseph' },
  { key: 'lead-sneha', name: 'Sneha Kulkarni', role: 'intern', scopeId: 'demo-lead-sneha', reportsTo: 'pm-joseph' },
  { key: 'lead-tarun', name: 'Tarun Bose', role: 'intern', scopeId: 'demo-lead-tarun', reportsTo: 'pm-leena' },
];

/* ------------------------------------------------------------------ *
 * Checklist state
 * ------------------------------------------------------------------ */

type ProgressMode = 'clean' | 'review' | 'rejected' | 'overdue';

/**
 * Build a plausible `checklist_state`: the first `done` catalog steps complete,
 * then one step in whatever situation `mode` describes. The gate reads this the
 * same way it reads a real project's, so progress bars, ball-in-court and the
 * attention ranking all come out of the same logic the product uses.
 */
function buildChecklistState(done: number, mode: ProgressMode, startedDaysAgo: number) {
  const state: Record<string, ChecklistItemStateSlice> = {};
  const span = Math.max(1, startedDaysAgo - 3);

  for (let i = 0; i < Math.min(done, CATALOG.length); i += 1) {
    const item = CATALOG[i]!;
    const completedOn = ymd(daysAgo(startedDaysAgo - Math.floor((span * i) / Math.max(done, 1))));
    state[item.id] = {
      status: 'completed',
      completedOn,
      notes: undefined,
    };
  }

  const current = CATALOG[done];
  if (current) {
    if (mode === 'review') {
      state[current.id] = {
        status: 'in-progress',
        reviewStatus: 'reviewing',
        reviewSource: current.responsibleRole === 'client' ? 'client_submission' : 'lead_manager_request',
        locked: true,
        clientSubmittedAt: daysAgo(4).toISOString(),
      };
    } else if (mode === 'rejected') {
      state[current.id] = {
        status: 'in-progress',
        reviewStatus: 'rejected',
        locked: true,
        clientSubmittedAt: daysAgo(9).toISOString(),
        unlockedFields: ['proposedName1'],
        rejectionNote: 'Proposed name conflicts with an existing mark — please send two alternatives.',
      };
    } else if (mode === 'overdue') {
      state[current.id] = { status: 'overdue' };
    } else {
      state[current.id] = { status: 'in-progress' };
    }
  }

  // Responses the surfaces actually read: statutory identifiers on pre-12, and
  // the deliverable file fields the client's Documents tiles look for
  // (`CLIENT_DELIVERABLE_FIELDS`). Only filled for steps the project reached.
  const responsesByStep: Record<string, Record<string, string>> = {
    'pre-8': {
      moaSubscriptionSheetSignedUrl: 'demo/moa-subscription-sheet-signed.pdf',
      aoaSubscriptionSheetSignedUrl: 'demo/aoa-subscription-sheet-signed.pdf',
    },
    'pre-12': {
      cin: `U74999KA${new Date().getFullYear()}PTC${100000 + done * 137}`,
      pan: `AAB${String.fromCharCode(65 + (done % 26))}A${1000 + done}K`,
      tan: `BLRA${10000 + done}G`,
      certificateOfIncorporationFinalUrl: 'demo/certificate-of-incorporation.pdf',
      panCardFinalUrl: 'demo/pan-card.pdf',
      tanCardFinalUrl: 'demo/tan-card.pdf',
    },
    'reg-4': { gstCertificateUrl: 'demo/gst-certificate.pdf' },
    'reg-8': { iecCertificateUrl: 'demo/iec-certificate.pdf' },
  };

  for (const [stepId, responses] of Object.entries(responsesByStep)) {
    const index = CATALOG.findIndex((item) => item.id === stepId);
    if (index < 0 || index >= done) continue;
    const existing = state[stepId];
    if (!existing) continue;
    state[stepId] = {
      ...existing,
      responses: { ...(existing.responses ?? {}), ...responses },
      deliveredToClientAt: daysAgo(Math.max(1, startedDaysAgo - index * 2)).toISOString(),
    } as ChecklistItemStateSlice;
  }

  return state;
}

/* ------------------------------------------------------------------ *
 * Projects
 * ------------------------------------------------------------------ */

type ProjectSpec = {
  slug: string;
  companyName: string;
  clientName: string;
  stage: 'Pre-Incorporation' | 'Post-Incorporation' | 'Operational Readiness';
  health: 'on-track' | 'at-risk' | 'overdue';
  legalForm: 'company' | 'llp';
  companyType: 'domestic' | 'foreign';
  parentEntityName?: string;
  leadKey: string | null;
  managerKey: string;
  clientKey: string;
  done: number;
  mode: ProgressMode;
  startedDaysAgo: number;
  /** Days since the row last changed — drives the idle / "quiet Nd" read. */
  idleDays: number;
  incorporatedDaysAgo?: number;
};

const PROJECTS: ProjectSpec[] = [
  {
    slug: 'demo-northwind-analytics',
    companyName: 'Northwind Analytics India Pvt Ltd',
    clientName: 'Northwind Analytics Inc.',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    legalForm: 'company',
    companyType: 'foreign',
    parentEntityName: 'Northwind Analytics Inc., Delaware',
    leadKey: 'lead-arjun',
    managerKey: 'pm-anita',
    clientKey: 'client-northwind',
    done: 2,
    mode: 'clean',
    startedDaysAgo: 18,
    idleDays: 1,
  },
  {
    slug: 'demo-kestrel-robotics',
    companyName: 'Kestrel Robotics India Pvt Ltd',
    clientName: 'Kestrel Robotics GmbH',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    legalForm: 'company',
    companyType: 'foreign',
    parentEntityName: 'Kestrel Robotics GmbH, Munich',
    leadKey: 'lead-divya',
    managerKey: 'pm-anita',
    clientKey: 'client-kestrel',
    done: 8,
    mode: 'review',
    startedDaysAgo: 44,
    idleDays: 2,
  },
  {
    slug: 'demo-alderson-foods',
    companyName: 'Alderson Foods India Pvt Ltd',
    clientName: 'Alderson Foods Ltd.',
    stage: 'Pre-Incorporation',
    health: 'at-risk',
    legalForm: 'company',
    companyType: 'foreign',
    parentEntityName: 'Alderson Foods Ltd., London',
    leadKey: 'lead-rohan',
    managerKey: 'pm-joseph',
    clientKey: 'client-alderson',
    done: 3,
    mode: 'rejected',
    startedDaysAgo: 52,
    idleDays: 9,
  },
  {
    slug: 'demo-halcyon-payments',
    companyName: 'Halcyon Payments India Pvt Ltd',
    clientName: 'Halcyon Payments Pte Ltd',
    stage: 'Post-Incorporation',
    health: 'on-track',
    legalForm: 'company',
    companyType: 'foreign',
    parentEntityName: 'Halcyon Payments Pte Ltd, Singapore',
    leadKey: 'lead-sneha',
    managerKey: 'pm-joseph',
    clientKey: 'client-halcyon',
    done: 16,
    mode: 'clean',
    startedDaysAgo: 120,
    idleDays: 0,
    incorporatedDaysAgo: 74,
  },
  {
    slug: 'demo-ironclad-labs',
    companyName: 'Ironclad Labs India Pvt Ltd',
    clientName: 'Ironclad Labs Inc.',
    stage: 'Post-Incorporation',
    health: 'overdue',
    legalForm: 'company',
    companyType: 'foreign',
    parentEntityName: 'Ironclad Labs Inc., Austin',
    leadKey: 'lead-tarun',
    managerKey: 'pm-leena',
    clientKey: 'client-ironclad',
    done: 21,
    mode: 'overdue',
    startedDaysAgo: 160,
    idleDays: 17,
    incorporatedDaysAgo: 118,
  },
  {
    slug: 'demo-meridian-health',
    companyName: 'Meridian Health India Pvt Ltd',
    clientName: 'Meridian Health Group',
    stage: 'Operational Readiness',
    health: 'on-track',
    legalForm: 'company',
    companyType: 'domestic',
    leadKey: 'lead-arjun',
    managerKey: 'pm-leena',
    clientKey: 'client-meridian',
    done: 39,
    mode: 'clean',
    startedDaysAgo: 280,
    idleDays: 3,
    incorporatedDaysAgo: 232,
  },
  {
    slug: 'demo-solstice-energy',
    companyName: 'Solstice Energy India Pvt Ltd',
    clientName: 'Solstice Energy Holdings',
    stage: 'Operational Readiness',
    health: 'on-track',
    legalForm: 'company',
    companyType: 'domestic',
    leadKey: 'lead-divya',
    managerKey: 'pm-anita',
    clientKey: 'client-solstice',
    done: CATALOG.length,
    mode: 'clean',
    startedDaysAgo: 400,
    idleDays: 6,
    incorporatedDaysAgo: 350,
  },
  {
    slug: 'demo-pinewood-logistics',
    companyName: 'Pinewood Logistics LLP',
    clientName: 'Pinewood Logistics LLP',
    stage: 'Pre-Incorporation',
    health: 'at-risk',
    legalForm: 'llp',
    companyType: 'domestic',
    leadKey: 'lead-rohan',
    managerKey: 'pm-joseph',
    clientKey: 'client-pinewood',
    done: 5,
    mode: 'clean',
    startedDaysAgo: 90,
    idleDays: 41,
  },
  {
    slug: 'demo-vantage-media',
    companyName: 'Vantage Media India Pvt Ltd',
    clientName: 'Vantage Media LLC',
    stage: 'Post-Incorporation',
    health: 'at-risk',
    legalForm: 'company',
    companyType: 'foreign',
    parentEntityName: 'Vantage Media LLC, New York',
    // Deliberately unassigned — the workload chart should show it.
    leadKey: null,
    managerKey: 'pm-leena',
    clientKey: 'client-vantage',
    done: 13,
    mode: 'clean',
    startedDaysAgo: 96,
    idleDays: 22,
    incorporatedDaysAgo: 48,
  },
  {
    slug: 'demo-quarry-digital',
    companyName: 'Quarry Digital India Pvt Ltd',
    clientName: 'Quarry Digital Ltd.',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    legalForm: 'company',
    companyType: 'foreign',
    parentEntityName: 'Quarry Digital Ltd., Dublin',
    leadKey: 'lead-sneha',
    managerKey: 'pm-anita',
    clientKey: 'client-quarry',
    done: 0,
    mode: 'clean',
    startedDaysAgo: 2,
    idleDays: 0,
  },
];

const CLIENTS: PersonSpec[] = PROJECTS.map((project) => ({
  key: project.clientKey,
  name: `${project.clientName.split(/[\s,]+/)[0]} Client`,
  role: 'client' as const,
  scopeId: `demo-org-${project.clientKey.replace('client-', '')}`,
}));

/* ------------------------------------------------------------------ *
 * Documents / audit / tasks
 * ------------------------------------------------------------------ */

const DOCUMENT_SPECS: { fileName: string; category: string; stepId: string; shared: boolean }[] = [
  { fileName: 'Name approval letter (RUN).pdf', category: 'deliverables', stepId: 'pre-2', shared: true },
  { fileName: 'Director KYC pack.pdf', category: 'documents', stepId: 'pre-3', shared: false },
  { fileName: 'Board resolution — signed.pdf', category: 'deliverables', stepId: 'pre-6', shared: true },
  { fileName: 'SPICe+ Part B acknowledgement.pdf', category: 'documents', stepId: 'pre-10', shared: false },
  { fileName: 'Certificate of Incorporation.pdf', category: 'deliverables', stepId: 'pre-12', shared: true },
  { fileName: 'PAN allotment letter.pdf', category: 'deliverables', stepId: 'post-1', shared: true },
  { fileName: 'GST registration certificate.pdf', category: 'deliverables', stepId: 'reg-1', shared: true },
  { fileName: 'Bank account opening kit.pdf', category: 'documents', stepId: 'post-3', shared: false },
];

const AUDIT_SPECS: { action: string; summary: (company: string) => string; actor: 'lead' | 'manager' | 'client' }[] = [
  { action: 'engagement.create', summary: (c) => `Created project ${c}`, actor: 'manager' },
  { action: 'engagement.checklist.submit', summary: () => 'Submitted Client Details for review', actor: 'client' },
  { action: 'engagement.checklist.review', summary: () => 'Approved Client Details', actor: 'manager' },
  { action: 'document.upload', summary: () => 'Uploaded Name approval letter (RUN).pdf', actor: 'lead' },
  { action: 'engagement.checklist.complete', summary: () => 'Marked Name Application complete', actor: 'lead' },
  { action: 'notify.email', summary: (c) => `Sent the weekly progress update for ${c}`, actor: 'lead' },
  { action: 'engagement.checklist.deliver', summary: () => 'Delivered Certificate of Incorporation to the client', actor: 'lead' },
  { action: 'document.upload', summary: () => 'Uploaded GST registration certificate.pdf', actor: 'lead' },
];

const TASK_SPECS: { title: string; description: string; status: string; dueInDays: number }[] = [
  { title: 'Chase DSC for the second director', description: 'Vendor said 48 hours; follow up if nothing lands.', status: 'open', dueInDays: 2 },
  { title: 'Draft the MOA object clause', description: 'Use the standard SaaS object clause and adapt the ancillary objects.', status: 'in-progress', dueInDays: 5 },
  { title: 'Book the bank account opening call', description: 'Client prefers Thursday mornings.', status: 'open', dueInDays: 9 },
];

/* ------------------------------------------------------------------ *
 * Seed
 * ------------------------------------------------------------------ */

async function upsertPerson(spec: PersonSpec): Promise<string> {
  const email = `${spec.key}${DEMO_EMAIL_DOMAIN}`;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [existing] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  const values = {
    email,
    passwordHash,
    name: spec.name,
    role: spec.role,
    internId: spec.role === 'intern' ? spec.scopeId : null,
    clientId: spec.role === 'client' ? spec.scopeId : null,
  };

  if (existing) {
    await db
      .update(profiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(profiles.id, existing.id));
    return existing.id;
  }

  const [row] = await db.insert(profiles).values(values).returning();
  return row!.id;
}

async function clearPreviousDemoRows(): Promise<void> {
  const oldEngagements = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(like(engagements.slug, `${DEMO_SLUG_PREFIX}%`));

  if (oldEngagements.length > 0) {
    const ids = oldEngagements.map((row) => row.id);
    // Audit rows survive engagement deletion (`on delete set null`), so clear
    // the demo ones explicitly rather than leaving orphaned entries behind.
    await db.delete(auditEvents).where(inArray(auditEvents.engagementId, ids));
    await db.delete(engagements).where(inArray(engagements.id, ids));
    console.log(`  removed ${ids.length} previous demo project(s)`);
  }

  const oldPeople = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(like(profiles.email, `%${DEMO_EMAIL_DOMAIN}`));

  if (oldPeople.length > 0) {
    const ids = oldPeople.map((row) => row.id);
    await db.delete(auditEvents).where(inArray(auditEvents.actorUserId, ids));
    await db.update(profiles).set({ reportsToManagerId: null }).where(inArray(profiles.reportsToManagerId, ids));
    await db.delete(profiles).where(inArray(profiles.id, ids));
    console.log(`  removed ${ids.length} previous demo account(s)`);
  }
}

async function main() {
  console.log('Seeding demo data (tagged rows only — your own data is untouched)…\n');

  console.log('Clearing any previous demo rows…');
  await clearPreviousDemoRows();

  console.log('\nCreating people…');
  const ids = new Map<string, string>();

  for (const spec of [...ADMINS, ...MANAGERS]) {
    ids.set(spec.key, await upsertPerson(spec));
  }
  for (const spec of LEADS) {
    ids.set(spec.key, await upsertPerson(spec));
  }
  for (const spec of CLIENTS) {
    ids.set(spec.key, await upsertPerson(spec));
  }

  // Leads report to a manager — the People screen and lead dashboard read this.
  for (const spec of LEADS) {
    if (!spec.reportsTo) continue;
    await db
      .update(profiles)
      .set({ reportsToManagerId: ids.get(spec.reportsTo)!, updatedAt: new Date() })
      .where(eq(profiles.id, ids.get(spec.key)!));
  }
  console.log(
    `  ${ADMINS.length} admin(s), ${MANAGERS.length} manager(s), ${LEADS.length} lead(s), ${CLIENTS.length} client(s)`,
  );

  console.log('\nCreating projects…');
  const leadScope = new Map(LEADS.map((spec) => [spec.key, spec.scopeId!]));
  const clientScope = new Map(CLIENTS.map((spec) => [spec.key, spec.scopeId!]));
  const created: { id: string; spec: ProjectSpec }[] = [];

  for (const spec of PROJECTS) {
    const managerId = ids.get(spec.managerKey)!;
    const clientUserId = ids.get(spec.clientKey)!;
    const internId = spec.leadKey ? leadScope.get(spec.leadKey)! : null;

    const [row] = await db
      .insert(engagements)
      .values({
        slug: spec.slug,
        companyName: spec.companyName,
        companyType: spec.companyType,
        entityLegalForm: spec.legalForm,
        incorporationDate: spec.incorporatedDaysAgo ? ymd(daysAgo(spec.incorporatedDaysAgo)) : null,
        parentEntityName: spec.parentEntityName ?? null,
        subsidiaryRegisteredAddress:
          spec.companyType === 'foreign' ? 'WeWork Prestige Central, Bengaluru 560001' : null,
        clientId: clientScope.get(spec.clientKey)!,
        clientUserId,
        clientName: spec.clientName,
        internId,
        managerId,
        stage: spec.stage,
        health: spec.health,
        checklistState: buildChecklistState(spec.done, spec.mode, spec.startedDaysAgo),
        createdAt: daysAgo(spec.startedDaysAgo),
        updatedAt: daysAgo(spec.idleDays),
      })
      .returning({ id: engagements.id });

    const engagementId = row!.id;
    created.push({ id: engagementId, spec });

    await db.insert(engagementManagers).values({ engagementId, managerId }).onConflictDoNothing();
    await db
      .insert(engagementClients)
      .values({ engagementId, userId: clientUserId, memberRole: 'owner' })
      .onConflictDoNothing();
    if (internId) {
      await db.insert(engagementLeads).values({ engagementId, internId }).onConflictDoNothing();
    }

    console.log(`  ${spec.companyName} — ${spec.stage}, ${spec.done}/${CATALOG.length} steps`);
  }

  console.log('\nCreating documents…');
  let documentCount = 0;
  for (const { id, spec } of created) {
    const uploadedBy = spec.leadKey ? ids.get(spec.leadKey)! : ids.get(spec.managerKey)!;
    // Only file documents for steps the project has actually reached.
    const reached = DOCUMENT_SPECS.filter((doc) => {
      const index = CATALOG.findIndex((item) => item.id === doc.stepId);
      return index >= 0 && index < spec.done;
    });
    for (const [i, doc] of reached.entries()) {
      await db.insert(documents).values({
        engagementId: id,
        category: doc.category,
        fileName: doc.fileName,
        objectKey: `demo/${spec.slug}/${doc.stepId}-${doc.fileName.replace(/\s+/g, '-').toLowerCase()}`,
        contentType: 'application/pdf',
        sizeBytes: 180_000 + i * 42_000,
        uploadedBy,
        stepId: doc.stepId,
        sharedWithClient: doc.shared,
        createdAt: daysAgo(Math.max(1, spec.startedDaysAgo - i * 6)),
      });
      documentCount += 1;
    }
  }
  console.log(`  ${documentCount} document(s)`);

  console.log('\nCreating activity trail…');
  let auditCount = 0;
  for (const { id, spec } of created) {
    const actorFor = (kind: 'lead' | 'manager' | 'client') => {
      if (kind === 'client') return { key: spec.clientKey, role: 'client' as const };
      if (kind === 'manager' || !spec.leadKey) return { key: spec.managerKey, role: 'manager' as const };
      return { key: spec.leadKey, role: 'intern' as const };
    };
    const entries = AUDIT_SPECS.slice(0, Math.max(3, Math.min(AUDIT_SPECS.length, Math.ceil(spec.done / 3) + 2)));

    for (const [i, entry] of entries.entries()) {
      const actor = actorFor(entry.actor);
      const actorId = ids.get(actor.key)!;
      const person =
        [...ADMINS, ...MANAGERS, ...LEADS, ...CLIENTS].find((p) => p.key === actor.key)!;
      await db.insert(auditEvents).values({
        actorUserId: actorId,
        actorRole: actor.role,
        actorEmail: `${actor.key}${DEMO_EMAIL_DOMAIN}`,
        actorName: person.name,
        engagementId: id,
        action: entry.action,
        summary: entry.summary(spec.companyName),
        metadata: {},
        createdAt: daysAgo(Math.max(0, spec.idleDays + (entries.length - i - 1) * 3)),
      });
      auditCount += 1;
    }
  }
  console.log(`  ${auditCount} audit event(s)`);

  console.log('\nCreating tasks…');
  let taskCount = 0;
  for (const [i, { id, spec }] of created.entries()) {
    if (!spec.leadKey || spec.done >= CATALOG.length) continue;
    const task = pick(TASK_SPECS, i);
    await db.insert(tasks).values({
      engagementId: id,
      assignedTo: ids.get(spec.leadKey)!,
      title: task.title,
      description: task.description,
      status: task.status,
      deadline: new Date(Date.now() + task.dueInDays * 86_400_000),
    });
    taskCount += 1;
  }
  console.log(`  ${taskCount} task(s)`);

  console.log('\nGenerating compliance filings…');
  // Real generation, not fabricated rows: seeds the obligation catalogue and
  // expands it against each engagement's trigger dates.
  const result = await systemGenerateComplianceInstances();
  console.log(`  ${result.upserted} filing(s) across ${result.engagements} project(s)`);

  // Give the runway some history: mark older filings filed, leave the recent
  // past overdue so the compliance panels have all four buckets.
  const demoIds = created.map((row) => row.id);
  if (demoIds.length > 0) {
    const rows = await db
      .select({ id: complianceInstances.id, dueDate: complianceInstances.dueDate })
      .from(complianceInstances)
      .where(inArray(complianceInstances.engagementId, demoIds));

    const today = ymd(new Date());
    let filed = 0;
    let overdue = 0;
    for (const [i, instance] of rows.entries()) {
      if (instance.dueDate >= today) continue;
      // Two out of every three past filings are done; the rest have slipped.
      if (i % 3 === 0) {
        await db
          .update(complianceInstances)
          .set({ status: 'overdue' })
          .where(eq(complianceInstances.id, instance.id));
        overdue += 1;
      } else {
        await db
          .update(complianceInstances)
          .set({ status: 'filed', filedOn: instance.dueDate, filedNote: 'Filed on the portal.' })
          .where(eq(complianceInstances.id, instance.id));
        filed += 1;
      }
    }
    console.log(`  marked ${filed} filed, ${overdue} overdue`);
  }

  console.log('\nDone. Demo logins (all use the password below):');
  console.log(`  password: ${DEMO_PASSWORD}`);
  for (const spec of [...ADMINS, ...MANAGERS, ...LEADS]) {
    console.log(`  ${spec.key}${DEMO_EMAIL_DOMAIN}  — ${spec.name} (${spec.role})`);
  }
  console.log(`  ${CLIENTS[0]!.key}${DEMO_EMAIL_DOMAIN}  — ${CLIENTS[0]!.name} (client, one per project)`);
  console.log('\nSuper admin view: super@vcfo.local / super123');
  console.log('Remove this data with: npm run db:seed-demo (rebuilds) or npm run db:purge-demo');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
