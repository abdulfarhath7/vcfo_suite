'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, PencilLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Chip } from '@/components/ui/spectrum-chip';
import { diffWords, type ClientEditAction } from '@/lib/board-resolution/client-edit';
import type { ClientEditView } from '@/lib/board-resolution/client-edit-flow';
import { requestEmailSend, type EmailDraftView } from '@/lib/email/request-email-send';
import { cn } from '@/lib/utils';

const ACTION_LABEL: Partial<Record<ClientEditAction, string>> = {
  confirm: 'Confirm edits',
  send: 'Send to the firm',
  receive: 'Confirm receipt',
  'manager-approve': 'Approve',
  'admin-approve': 'Approve',
  return: 'Return to Lead and Client',
  resubmit: 'Send to Manager',
  'send-final': 'Send final to Client',
};

/** Actions that open a box for text first: the return reason. */
const NEEDS_TEXT: Partial<Record<ClientEditAction, { label: string; required: boolean; placeholder: string }>> = {
  return: { label: 'Reason for the return', required: true, placeholder: 'What must the Lead and the Client change?' },
};

function TrackedChange({ before, after }: { before: string; after: string }) {
  return (
    <p className="text-[13.5px] leading-relaxed text-ink">
      {diffWords(before, after).map((part, i) =>
        part.kind === 'same' ? (
          <span key={i}>{part.text}</span>
        ) : part.kind === 'added' ? (
          <ins key={i} className="rounded-sm bg-positive-soft px-0.5 text-positive no-underline">{part.text}</ins>
        ) : (
          <del key={i} className="rounded-sm bg-danger-soft px-0.5 text-danger">{part.text}</del>
        ),
      )}
    </p>
  );
}

/**
 * BR-04 / BR-05 / BR-06: the client's edit of the board resolution, on the "Draft board
 * resolution" step, for every role. The client edits the paragraphs, confirms and sends; the
 * lead, the manager and the admin read the edits as tracked changes and move them along the
 * chain. After a return the document is "With Lead and Client": both may edit it, and only the
 * Lead sends it to the Manager again. The server decides which buttons each role gets (`view.actions`).
 */
// The viewer's role is `viewerRole`, because JSX lint reads a prop named `role` as an ARIA role.
export function BoardResolutionClientEdit({
  engagementId,
  viewerRole: role,
  refreshKey,
}: {
  engagementId: string;
  viewerRole: string;
  /** Changes when the board resolution changes elsewhere (realtime), so the panel reloads. */
  refreshKey?: string;
}) {
  const [view, setView] = useState<ClientEditView | null>(null);
  const [editing, setEditing] = useState(false);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<ClientEditAction | null>(null);
  const [note, setNote] = useState('');
  const base = `/api/engagements/${encodeURIComponent(engagementId)}/board-resolution/client-edit`;
  const isClient = role === 'client';

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      if (res.ok) setView(((await res.json()) as { view: ClientEditView | null }).view);
    } catch {
      /* the panel stays hidden */
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const call = async (method: 'PUT' | 'POST', body: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(base, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { view?: ClientEditView | null; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'That did not work. Try again.');
        return false;
      }
      setView(json.view ?? null);
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (!view) return null;
  if (!isClient && view.stage === null) return null;

  const canEdit = view.actions.includes('save') || view.actions.includes('correct');
  const moves = view.actions.filter((a) => a !== 'save' && a !== 'correct');
  const startEdit = () => {
    setParagraphs(view.edited ?? view.original);
    setEditing(true);
  };
  const save = async () => {
    if (await call('PUT', { paragraphs })) {
      setEditing(false);
      toast.success('Edits saved. The firm’s original version is kept.');
    }
  };
  const act = async (action: ClientEditAction, text?: string) => {
    if (await call('POST', { action, note: text ?? null })) {
      setAsking(null);
      setNote('');
    }
  };
  // GL-07: "Send to the firm" opens the shared Send email pop-up to the Lead. Cancel sends
  // nothing and the edit stays with the client. With no Lead email there is no draft, and the
  // move goes ahead with the in-app notice alone.
  const sendToFirm = async () => {
    setBusy(true);
    let draft: EmailDraftView | null = null;
    try {
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', preview: true }) });
      const json = (await res.json().catch(() => ({}))) as { draft?: EmailDraftView | null; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'That did not work. Try again.');
        return;
      }
      draft = json.draft ?? null;
    } finally {
      setBusy(false);
    }
    if (!draft) {
      await act('send');
      return;
    }
    const outcome = await requestEmailSend({
      url: base,
      body: { action: 'send' },
      title: 'Send the edited board resolution to your Lead',
      sendLabel: 'Send to the firm',
      draft,
    });
    if (outcome.sent) await load();
  };

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-line bg-surface-raised p-4" aria-label="Edited board resolution" data-testid="br-client-edit">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="text-[14px] font-semibold text-ink">{isClient && view.stage === null ? 'Want to change the wording?' : 'Edited board resolution'}</h4>
        {view.holder ? <Chip raw tone={view.holder === 'With you' || view.holder.endsWith(' and you') ? 'warn' : 'prog'}>{view.holder}</Chip> : null}
        {view.edited ? (
          <a className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-brand hover:underline" href={`${base}?download=1`}>
            <Download className="h-3.5 w-3.5" aria-hidden /> Download edited version
          </a>
        ) : null}
      </header>

      {isClient && view.stage === null ? (
        <p className="text-[13px] text-ink-muted">You can edit the draft here. The firm keeps its original version, and your edits go to your Lead, the Manager and the Admin for approval.</p>
      ) : null}
      {view.returnNote && view.stage === 'returned' ? (
        <div className="space-y-1 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-ink">
          <p>Returned: {view.returnNote}</p>
          <p className="text-ink-muted">
            {isClient
              ? 'You and your Lead can both edit it now. Your Lead sends it to the Manager again.'
              : 'The Lead and the Client can both edit it now. The Lead sends it to the Manager again.'}
          </p>
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-2">
          {paragraphs.map((text, i) =>
            view.original[i]?.trim() || text.trim() ? (
              <Textarea
                key={i}
                aria-label={`Paragraph ${i + 1}`}
                className="min-h-[44px] text-[13.5px]"
                value={text}
                onChange={(e) => setParagraphs((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
              />
            ) : null,
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={save}>Save edits</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : view.changes.length ? (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-ink-muted">
            {view.changes.length} changed {view.changes.length === 1 ? 'paragraph' : 'paragraphs'}: <ins className="text-positive no-underline">added</ins> and <del className="text-danger">removed</del> words are marked.
          </p>
          {view.changes.map((c) => (
            <div key={c.index} className="rounded-md bg-surface-sunken/50 px-3 py-2">
              <p className="mb-1 text-[11.5px] font-medium text-ink-muted">Paragraph {c.index + 1}</p>
              <TrackedChange before={c.before} after={c.after} />
            </div>
          ))}
        </div>
      ) : null}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={startEdit}>
              <PencilLine className="mr-1 h-3.5 w-3.5" aria-hidden />
              {view.edited ? 'Edit again' : 'Edit draft'}
            </Button>
          ) : null}
          {moves.map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={action === 'return' ? 'outline' : 'default'}
              disabled={busy}
              onClick={() => (action === 'send' ? void sendToFirm() : NEEDS_TEXT[action] ? setAsking(action) : void act(action))}
            >
              {ACTION_LABEL[action] ?? action}
            </Button>
          ))}
        </div>
      ) : null}

      {asking && NEEDS_TEXT[asking] ? (
        <div role="dialog" aria-label={ACTION_LABEL[asking]} className="space-y-2 rounded-md border border-line bg-surface p-3">
          <label className="block text-[12.5px] font-medium text-ink" htmlFor="br-client-edit-note">{NEEDS_TEXT[asking]!.label}</label>
          <Textarea id="br-client-edit-note" value={note} placeholder={NEEDS_TEXT[asking]!.placeholder} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy || (NEEDS_TEXT[asking]!.required && !note.trim())} onClick={() => act(asking, note)}>
              {ACTION_LABEL[asking]}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {view.audit?.length ? (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer text-ink-muted">Audit record ({view.audit.length})</summary>
          <ol className="mt-2 space-y-1.5">
            {view.audit.map((row, i) => (
              <li key={i} className={cn('rounded-md px-2 py-1', i === 0 && 'bg-surface-sunken/50')}>
                <span className="text-ink">{row.summary}</span>{' '}
                <span className="text-ink-muted">· {new Date(row.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span>
                {row.changes?.map((c) => (
                  <span key={c.index} className="mt-1 block text-ink-muted">
                    Paragraph {c.index + 1}: “{c.before}” → “{c.after}”
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
