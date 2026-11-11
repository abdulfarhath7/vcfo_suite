/**
 * BR-04 / BR-05: the client edits the board resolution the firm sent, and the edit goes through
 * the firm's approval chain before it comes back as the final document. One stage machine for
 * every role; the server checks each move, the screens only offer the moves it allows.
 *
 *   editing    the client edits (only while the document is "With you")
 *   confirmed  the client locked the edits ("Confirm edits")
 *   sent       the client sent the confirmed document to the firm (GL-07 pop-up)
 *   manager    the lead confirmed receipt; the manager reviews
 *   admin      the manager approved; the admin reviews (never before the manager)
 *   returned   the manager or admin returned it with a reason; the lead corrects it
 *   approved   the admin approved; the lead sends the final document to the client
 *   final      the final document is with the client to sign
 *
 * After a return the lead corrects the document and sends it to the manager again (the change
 * list says a return goes back to the lead). The firm's original version is never replaced.
 */

export type ClientEditStage = 'editing' | 'confirmed' | 'sent' | 'manager' | 'admin' | 'returned' | 'approved' | 'final';

export type ClientEditAction =
  | 'save'
  | 'correct'
  | 'confirm'
  | 'send'
  | 'receive'
  | 'manager-approve'
  | 'admin-approve'
  | 'return'
  | 'resubmit'
  | 'send-final';

export interface ClientEditState {
  stage: ClientEditStage;
  /** The client's version, as stored board resolution content (one paragraph per line). */
  content: string;
  updatedAt: string;
  updatedBy?: string;
  /** The reason of the last return. */
  returnNote?: string;
  /** When the last "edited" notice went out, to fold ten minutes of saves into one (BR-06). */
  editNotifiedAt?: string;
}

export const CLIENT_EDIT_STAGES: readonly ClientEditStage[] = ['editing', 'confirmed', 'sent', 'manager', 'admin', 'returned', 'approved', 'final'];

export type ClientEditRole = 'client' | 'intern' | 'manager' | 'admin' | 'super_admin' | string;

const isFirmAdmin = (role: ClientEditRole) => role === 'admin' || role === 'super_admin';

/** Where each action is allowed, who may take it, and the stage it leads to. */
const MOVES: Record<ClientEditAction, { from: ReadonlyArray<ClientEditStage | null>; roles: (role: ClientEditRole) => boolean; to: ClientEditStage }> = {
  save: { from: [null, 'editing'], roles: (r) => r === 'client', to: 'editing' },
  // After a return the lead corrects the client's version, then sends it to the manager again.
  correct: { from: ['returned'], roles: (r) => r === 'intern', to: 'returned' },
  confirm: { from: ['editing'], roles: (r) => r === 'client', to: 'confirmed' },
  send: { from: ['confirmed'], roles: (r) => r === 'client', to: 'sent' },
  receive: { from: ['sent'], roles: (r) => r === 'intern', to: 'manager' },
  // The manager approves first; the admin never approves before the manager has.
  'manager-approve': { from: ['manager'], roles: (r) => r === 'manager', to: 'admin' },
  'admin-approve': { from: ['admin'], roles: isFirmAdmin, to: 'approved' },
  return: { from: ['manager', 'admin'], roles: (r) => r === 'manager' || isFirmAdmin(r), to: 'returned' },
  resubmit: { from: ['returned'], roles: (r) => r === 'intern', to: 'manager' },
  'send-final': { from: ['approved'], roles: (r) => r === 'intern', to: 'final' },
};

/** The next stage, or the reason the move is refused. */
export function nextClientEditStage(
  current: ClientEditStage | null,
  action: ClientEditAction,
  role: ClientEditRole,
  note?: string | null,
): { ok: true; stage: ClientEditStage } | { ok: false; error: string } {
  const move = MOVES[action];
  if (!move.roles(role)) return { ok: false, error: 'not_your_move' };
  if (!move.from.includes(current)) return { ok: false, error: 'wrong_stage' };
  // Each reviewer returns at their own stage.
  if (action === 'return' && (current === 'manager' ? role !== 'manager' : !isFirmAdmin(role))) return { ok: false, error: 'not_your_move' };
  if (action === 'return' && !note?.trim()) return { ok: false, error: 'return_needs_reason' };
  return { ok: true, stage: move.to };
}

/** The moves `role` can make now, for the buttons. */
export function availableClientEditActions(current: ClientEditStage | null, role: ClientEditRole): ClientEditAction[] {
  return (Object.keys(MOVES) as ClientEditAction[]).filter((action) => {
    if (action === 'save' && current === null) return false;
    const result = nextClientEditStage(current, action, role, 'x');
    return result.ok;
  });
}

/** Who holds the work at each stage (BR-03 chip). */
export function clientEditHolder(stage: ClientEditStage): 'client' | 'lead' | 'manager' | 'admin' {
  switch (stage) {
    case 'editing':
    case 'confirmed':
    case 'final':
      return 'client';
    case 'manager':
      return 'manager';
    case 'admin':
      return 'admin';
    default:
      return 'lead';
  }
}

export const CLIENT_EDIT_ACTION_TEXT: Record<ClientEditAction, string> = {
  save: 'edited the board resolution',
  correct: 'corrected the returned board resolution',
  confirm: 'confirmed the edits to the board resolution',
  send: 'sent the edited board resolution to the firm',
  receive: 'confirmed receipt of the edited board resolution and sent it to the manager',
  'manager-approve': 'approved the edited board resolution',
  'admin-approve': 'approved the edited board resolution',
  return: 'returned the edited board resolution',
  resubmit: 'sent the corrected board resolution to the manager',
  'send-final': 'sent the final board resolution to the client',
};

export function parseClientEditState(raw: unknown): ClientEditState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.stage !== 'string' || !CLIENT_EDIT_STAGES.includes(o.stage as ClientEditStage)) return undefined;
  return {
    stage: o.stage as ClientEditStage,
    content: typeof o.content === 'string' ? o.content : '',
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '',
    updatedBy: typeof o.updatedBy === 'string' ? o.updatedBy : undefined,
    returnNote: typeof o.returnNote === 'string' ? o.returnNote : undefined,
    editNotifiedAt: typeof o.editNotifiedAt === 'string' ? o.editNotifiedAt : undefined,
  };
}

/** Paragraph pairs whose text changed: what the audit record stores (before and after). */
export function changedParagraphs(original: string[], edited: string[]): Array<{ index: number; before: string; after: string }> {
  const out: Array<{ index: number; before: string; after: string }> = [];
  const n = Math.max(original.length, edited.length);
  for (let i = 0; i < n; i += 1) {
    const before = original[i] ?? '';
    const after = edited[i] ?? '';
    if (before !== after) out.push({ index: i, before, after });
  }
  return out;
}

export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string };

/** Word-level tracked changes between two paragraphs (longest common subsequence of words). */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter((t) => t !== '');
  const b = after.split(/(\s+)/).filter((t) => t !== '');
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push('same', a[i]!);
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push('removed', a[i]!);
      i += 1;
    } else {
      push('added', b[j]!);
      j += 1;
    }
  }
  while (i < m) push('removed', a[i++]!);
  while (j < n) push('added', b[j++]!);
  return parts;
}

/** BR-06: ten minutes of saves by one client member make one notice. */
export const EDIT_NOTICE_WINDOW_MS = 10 * 60 * 1000;

export function shouldNotifyEdit(state: ClientEditState | undefined, now: Date): boolean {
  const last = state?.editNotifiedAt ? new Date(state.editNotifiedAt).getTime() : NaN;
  return Number.isNaN(last) || now.getTime() - last >= EDIT_NOTICE_WINDOW_MS;
}
