'use client';

/** Pieces both pages use: links, the decision dialog, the Stage hint, the error panel, the left-edge legend. */
import { useState, type ReactNode } from 'react';
import type { Engagement } from '@/data/engagements';
import { stepSlugForItemId } from '@/lib/slug';
import { useConsole } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, Icon } from '../../ui';
import { plural } from './model';
import '../../css/96-approvals.css';

export const clientHref = (base: string, e: Pick<Engagement, 'id' | 'slug'>) => `${base}/projects/${encodeURIComponent(e.slug ?? e.id)}`;
export const stepHref = (base: string, e: Pick<Engagement, 'id' | 'slug'>, itemId: string) => `${clientHref(base, e)}/step/${stepSlugForItemId(itemId)}`;

/** A decision with a note (prototype mxSendBack / mxDecide): the note may be required. */
export function NoteModal({
  title,
  sub,
  label,
  hint,
  placeholder,
  required,
  confirm,
  banner,
  run,
}: {
  title: string;
  sub: ReactNode;
  label: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  confirm: string;
  banner?: ReactNode;
  /** Resolves with the confirmation toast; throws with the reason. */
  run: (note: string) => Promise<string>;
}) {
  const { closeModal, toast } = useConsole();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (required && !note.trim()) {
      setErr('Say what needs to change.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const msg = await run(note.trim());
      closeModal();
      toast(msg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the decision. Try again.');
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title={title}
      sub={sub}
      foot={
        <>
          <Btn onClick={closeModal} disabled={busy}>
            Cancel
          </Btn>
          <span className="sp" />
          <Btn cls="pri" ico="check" disabled={busy || (required && !note.trim())} onClick={() => void go()}>
            {busy ? 'Saving…' : confirm}
          </Btn>
        </>
      }
    >
      {banner}
      <div className="mx-form2 one">
        <label className="mx-f">
          <span className="mx-fl">{label}</span>
          <textarea className="mx-in ap-ta" rows={4} maxLength={2000} value={note} placeholder={placeholder} onChange={(e) => setNote(e.target.value)} />
          {hint ? <span className="mx-fh">{hint}</span> : null}
        </label>
      </div>
      {err ? (
        <p className="ap-err" role="alert">
          {err}
        </p>
      ) : null}
    </ModalBody>
  );
}

/** "2 more are on clients in another stage" with a way back to All. */
export function ScopeHint({ hidden, what }: { hidden: number; what: string }) {
  const { scope, setScope } = useConsole();
  if (scope === 'all' || hidden <= 0) return null;
  return (
    <p className="ap-hint">
      <Icon name="alert" size={16} />
      <span>{`${plural(hidden, what)} ${hidden === 1 ? 'is' : 'are'} on clients in the other stage.`}</span>
      <button type="button" className="link" onClick={() => setScope('all')}>
        Show all stages
      </button>
    </p>
  );
}

export function ErrorPanel({ what, retry }: { what: string; retry: () => void }) {
  return (
    <section className="glass panel mx-p">
      <div className="mx-empty ap-bad">
        <Icon name="alert" />
        <b>{what}</b>
        <span>The connection dropped or the server did not answer.</span>
        <Btn cls="sm" ico="back" onClick={retry}>
          Try again
        </Btn>
      </div>
    </section>
  );
}

/** What the card's left edge means (README: every colour explains itself). */
export function EdgeLegend({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="ap-foot" aria-label="Card edge colours">
      {items.map(([color, label]) => (
        <span key={label} className="ap-lk">
          <i className="ap-sw" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
