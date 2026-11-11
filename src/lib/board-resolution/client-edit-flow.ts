import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { listAuditEvents, recordAuditEvent } from '@/db/repositories/audit-events';
import { getBoardResolutionByEngagementId } from '@/db/repositories/board-resolution';
import { checklistStateFromRow, getEngagementById, patchChecklistItem } from '@/db/repositories/engagements';
import { resolveEngagementRecipients, type EngagementParty } from '@/db/repositories/engagement-recipients';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import {
  parseBoardResolutionPatchContent,
  serializeBoardResolutionPatchContent,
} from '@/lib/board-resolution/board-resolution-docx-body';
import {
  availableClientEditActions,
  changedParagraphs,
  CLIENT_EDIT_ACTION_TEXT,
  clientEditHolder,
  nextClientEditStage,
  shouldNotifyEdit,
  type ClientEditAction,
  type ClientEditStage,
  type ClientEditState,
} from '@/lib/board-resolution/client-edit';
import { workHolderLabel, type WorkHolderTeam } from '@/lib/checklist/work-holder';
import { companyFromAddress, sendEmail } from '@/lib/email/send-email';
import { MANAGER_APPROVAL_STEP_ID } from '@/lib/incorporation/pre-inc-direct-flow';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { stepPathForRole } from '@/lib/projects/project-step-path';
import { siteUrl } from '@/lib/site-url';

const STEP = MANAGER_APPROVAL_STEP_ID;
const AUDIT_PREFIX = 'board_resolution.client_edit';

export interface ClientEditView {
  stage: ClientEditStage | null;
  /** The firm's version, one paragraph per entry. Never replaced by a client edit. */
  original: string[];
  /** The client's version, when there is one. */
  edited: string[] | null;
  changes: Array<{ index: number; before: string; after: string }>;
  returnNote?: string;
  /** The moves this viewer can make now. */
  actions: ClientEditAction[];
  holder: string | null;
  /** Staff only: the document's audit record, newest first. */
  audit?: Array<{ at: string; by: string; role: string; summary: string; changes?: Array<{ index: number; before: string; after: string }> }>;
}

async function load(ctx: AuthContext, engagementId: string) {
  const engagement = await getEngagementById(ctx, engagementDbId(engagementId));
  if (!engagement) throw new Error('Engagement not found or not permitted');
  const doc = await getBoardResolutionByEngagementId(ctx, engagement.id);
  const state = checklistStateFromRow(engagement);
  const slice = state[STEP];
  return { engagement, doc, slice, edit: slice?.brClientEdit };
}

const textsOf = (content: string) => parseBoardResolutionPatchContent(content).map((p) => p.text);

/** BR-04: the client edits only while the firm's final document is "With you". */
function documentWithClient(doc: Awaited<ReturnType<typeof getBoardResolutionByEngagementId>>, slice: { deliveredToClientAt?: string } | undefined) {
  return Boolean(doc && doc.status === 'finalized' && slice?.deliveredToClientAt?.trim() && !doc.signedStoragePath?.trim());
}

export async function getClientEditView(ctx: AuthContext, engagementId: string): Promise<ClientEditView | null> {
  const { engagement, doc, slice, edit } = await load(ctx, engagementId);
  if (!doc || doc.status !== 'finalized') return null;
  const stage = edit?.stage ?? null;
  const original = textsOf(doc.content);
  const edited = edit ? textsOf(edit.content) : null;
  let actions = availableClientEditActions(stage, ctx.role);
  // BR-03: the client reads the first name of the Lead and the Manager in the holder chip.
  const team = ctx.role === 'client' && stage ? await teamNames(engagement.id) : undefined;
  if (stage === null && ctx.role === 'client' && documentWithClient(doc, slice)) actions = ['save'];
  if (stage === null && ctx.role !== 'client') actions = [];
  const view: ClientEditView = {
    stage,
    original,
    edited,
    changes: edited ? changedParagraphs(original, edited) : [],
    returnNote: edit?.returnNote,
    actions,
    holder: stage ? workHolderLabel(clientEditHolder(stage), ctx.role === 'client' ? 'client' : 'staff', team) : null,
  };
  if (ctx.role !== 'client') {
    const rows = await listAuditEvents(ctx, { engagementId: engagement.id, limit: 200 });
    view.audit = rows
      .filter((row) => row.action.startsWith(AUDIT_PREFIX))
      .map((row) => ({
        at: row.created_at,
        by: row.actor_name || row.actor_email || 'Someone',
        role: row.actor_role ?? '',
        summary: row.summary ?? row.action,
        changes: Array.isArray(row.metadata?.changes) ? (row.metadata.changes as ClientEditView['changes']) : undefined,
      }));
  }
  return view;
}

/** The Lead and the Manager of the engagement, for the client's holder chip. */
async function teamNames(engagementDbIdValue: string): Promise<WorkHolderTeam | undefined> {
  const recipients = await resolveEngagementRecipients(engagementDbIdValue).catch(() => null);
  return recipients ? { lead: recipients.lead?.name, manager: recipients.manager?.name } : undefined;
}

/** "With Lead · Divya" reads "with Lead · Divya" inside a sentence; names keep their capitals. */
const inSentence = (label: string) => label.replace(/^With /, 'with ');

/** The client's (or, after a return, the lead's or the client's) paragraphs over the firm's structure. */
function contentWithTexts(baseContent: string, texts: string[]): string {
  const base = parseBoardResolutionPatchContent(baseContent);
  return serializeBoardResolutionPatchContent(
    base.map((para, i) => {
      const text = texts[i] ?? para.text;
      // An unchanged paragraph keeps its bold markup; a rewritten one is plain text.
      return text === para.text ? para : { text, align: para.align };
    }),
  );
}

export async function saveClientEdit(ctx: AuthContext, engagementId: string, texts: string[]): Promise<ClientEditView | null> {
  const { engagement, doc, slice, edit } = await load(ctx, engagementId);
  if (!doc) throw new Error('board_resolution_not_generated');
  const stage = edit?.stage ?? null;
  // BR-05: after a return the lead and the client both correct the document; before it, the client saves.
  const action: ClientEditAction = stage === 'returned' ? 'correct' : 'save';
  if (action === 'save' && !documentWithClient(doc, slice)) throw new Error('not_with_client');
  const next = nextClientEditStage(stage, action, ctx.role);
  if ('error' in next) throw new Error(next.error);

  const before = edit ? textsOf(edit.content) : textsOf(doc.content);
  const content = contentWithTexts(edit?.content ?? doc.content, texts);
  const after = textsOf(content);
  const changes = changedParagraphs(before, after);
  if (!changes.length && edit) return getClientEditView(ctx, engagementId);

  const now = new Date();
  const notify = shouldNotifyEdit(edit, now) || edit?.updatedBy !== ctx.userId;
  const state: ClientEditState = {
    ...(edit ?? {}),
    stage: next.stage,
    content,
    updatedAt: now.toISOString(),
    updatedBy: ctx.userId,
    ...(notify ? { editNotifiedAt: now.toISOString() } : {}),
  };
  await patchChecklistItem(ctx, engagement.id, STEP, { brClientEdit: state });
  // BR-04: name, role, time and the text before and after, for every save.
  await recordAuditEvent(ctx, {
    engagementId: engagement.id,
    action: `${AUDIT_PREFIX}.${action}`,
    summary: `${ctx.name || 'Someone'} (${roleWord(ctx.role)}) changed ${changes.length} ${changes.length === 1 ? 'paragraph' : 'paragraphs'} of the board resolution`,
    metadata: { changes },
  });
  if (notify) await notifyParticipants(ctx, engagement.id, action, next.stage);
  return getClientEditView(ctx, engagementId);
}

export async function actOnClientEdit(
  ctx: AuthContext,
  engagementId: string,
  action: Exclude<ClientEditAction, 'save' | 'correct'>,
  note?: string | null,
): Promise<ClientEditView | null> {
  const { engagement, edit } = await load(ctx, engagementId);
  if (!edit) throw new Error('no_client_edit');
  const next = nextClientEditStage(edit.stage, action, ctx.role, note);
  if ('error' in next) throw new Error(next.error);

  const now = new Date().toISOString();
  await patchChecklistItem(ctx, engagement.id, STEP, {
    brClientEdit: {
      ...edit,
      stage: next.stage,
      updatedAt: now,
      returnNote: action === 'return' ? note!.trim() : next.stage === 'manager' ? undefined : edit.returnNote,
    },
  });
  await recordAuditEvent(ctx, {
    engagementId: engagement.id,
    action: `${AUDIT_PREFIX}.${action}`,
    summary: `${ctx.name || 'Someone'} (${roleWord(ctx.role)}) ${CLIENT_EDIT_ACTION_TEXT[action]}${action === 'return' ? `: ${note!.trim()}` : ''}`,
    metadata: action === 'return' ? { reason: note!.trim() } : {},
  });
  if (action === 'send') await emailFirm(ctx, engagement.id, note);
  await notifyParticipants(ctx, engagement.id, action, next.stage, action === 'return' ? note : null);
  return getClientEditView(ctx, engagementId);
}

function roleWord(role: string): string {
  if (role === 'intern') return 'Lead';
  if (role === 'client') return 'Client';
  if (role === 'manager') return 'Manager';
  return 'Admin';
}

const uniq = (parties: Array<EngagementParty | null | undefined>) => {
  const seen = new Set<string>();
  return parties.filter((p): p is EngagementParty => Boolean(p?.userId) && !seen.has(p!.userId!) && Boolean(seen.add(p!.userId!)));
};

/**
 * BR-06: one in-app notice per participant (the lead, the manager, the admins and every client
 * member), never to the person who acted: who did it, what they did and who holds the work now.
 * No email: email stays manual (GL-07).
 */
async function notifyParticipants(ctx: AuthContext, engagementDbIdValue: string, action: ClientEditAction, stage: ClientEditStage, note?: string | null) {
  try {
    const recipients = await resolveEngagementRecipients(engagementDbIdValue);
    if (!recipients) return;
    const project = { id: recipients.appId, slug: recipients.slug };
    const holder = clientEditHolder(stage);
    const team: WorkHolderTeam = { lead: recipients.lead?.name, manager: recipients.manager?.name };
    const actor = ctx.name?.trim() || 'Someone';
    const groups: Array<{ role: 'client' | 'intern' | 'manager' | 'admin'; parties: EngagementParty[] }> = [
      { role: 'client', parties: uniq([...recipients.clients, recipients.client]) },
      { role: 'intern', parties: uniq([...recipients.leads, recipients.lead]) },
      { role: 'manager', parties: uniq([...recipients.managers, recipients.manager]) },
      { role: 'admin', parties: uniq(recipients.admins) },
    ];
    const done = new Set<string>([ctx.userId]);
    const drafts = groups.flatMap(({ role, parties }) =>
      parties
        .filter((p) => !done.has(p.userId!) && Boolean(done.add(p.userId!)))
        .map((p) => {
          const label = workHolderLabel(holder, role === 'client' ? 'client' : 'staff', team);
          return {
            userId: p.userId!,
            kind: 'checklist.review' as const,
            title: `Board resolution: ${label}`,
            body: `${actor} ${CLIENT_EDIT_ACTION_TEXT[action]}${note?.trim() ? ` (${note.trim()})` : ''}. It is now ${inSentence(label)}.`,
            engagementId: recipients.appId,
            companyName: recipients.companyName,
            itemId: STEP,
            href: stepPathForRole(role, project, STEP, { boardResolution: true }),
            actorId: ctx.userId,
            actorName: actor,
          };
        }),
    );
    if (drafts.length) await createNotificationsForUsers(drafts);
  } catch (err) {
    console.error('[board-resolution] client edit notice failed', err);
  }
}

/** BR-05 step 3: the client's "Send to the firm", sent when the client presses Send in the pop-up. */
async function emailFirm(ctx: AuthContext, engagementDbIdValue: string, message?: string | null) {
  try {
    const recipients = await resolveEngagementRecipients(engagementDbIdValue);
    const leads = recipients ? uniq([...recipients.leads, recipients.lead]) : [];
    const to = leads.map((l) => l.email).filter((e): e is string => Boolean(e?.trim()));
    if (!recipients || !to.length) return;
    const link = `${siteUrl()}${stepPathForRole('intern', { id: recipients.appId, slug: recipients.slug }, STEP, { boardResolution: true })}`;
    const text = [
      `${ctx.name || 'Your client'} confirmed their edits to the board resolution of ${recipients.companyName} and sent it to you.`,
      message?.trim() ? `\nMessage: ${message.trim()}` : '',
      `\nOpen it: ${link}`,
    ].join('\n');
    await sendEmail({
      to,
      from: companyFromAddress({ slug: recipients.slug, companyName: recipients.companyName }),
      replyTo: ctx.email ? [ctx.email] : undefined,
      subject: `Edited board resolution: ${recipients.companyName}`,
      text,
      html: text.split('\n').map((line) => `<p>${line.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)}</p>`).join(''),
      purpose: 'board_resolution.client_edit.send',
    });
  } catch (err) {
    console.error('[board-resolution] client edit email failed', err);
  }
}

/** The client's version as a Word file: the firm's file with the edited paragraphs patched in. */
export async function clientEditContent(ctx: AuthContext, engagementId: string): Promise<{ content: string; storagePath: string } | null> {
  const { doc, edit } = await load(ctx, engagementId);
  if (!doc?.storagePath?.trim() || !edit) return null;
  return { content: edit.content, storagePath: doc.storagePath };
}
