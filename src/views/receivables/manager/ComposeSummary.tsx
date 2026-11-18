'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { withSignName } from '@/lib/receivables/sign-name';
import { useKeepSignName } from '@/hooks/use-receivables-v2';
import { SignNameField } from './SignNameField';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { toastError, toastInfo, toastLoading, toastSuccess } from '@/lib/toast-errors';
import { isEmailAddress, splitTypedRecipients } from '@/lib/email/recipient-input';
import type { EmailRecipient } from '@/lib/receivables/model';
import type { ManagerSheetDto } from '@/lib/receivables/wire';
import { summarySendOutcome, useOutlookStatus, useSendSummary, useSummary, type useReceivablesActions } from '@/hooks/use-receivables';
import { cn } from '@/lib/utils';
import { stamp } from '../format';

/**
 * Send email: the summary in the finance team's format, built from the published version, sent
 * from the sender's own Outlook (owner, 17 Nov 2026). Each person picked gets an email of their
 * own, shown as a card: a client partner's holds only the invoices of their own clients; a leader's
 * (a leadership digest recipient) or anyone else's holds the whole sheet. Each card has its own Cc,
 * subject and editable body. A client partner is never allowed in Cc or on another card. No Excel
 * file is ever attached.
 */

type Field = 'to' | 'cc' | 'bcc';

export const OUTLOOK_CONNECT_HREF = '/api/outlook/connect?return=/receivables/manager';

export function RecipientRow({ field, label, people, contacts, onChange }: { field: Field; label: string; people: EmailRecipient[]; contacts: EmailRecipient[]; onChange: (next: EmailRecipient[]) => void }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    // A whole known name ("Yash Babbar") first, before the text is split at spaces and commas.
    const named = contacts.find((c) => c.name && c.name.toLowerCase() === raw.trim().toLowerCase());
    const tokens = named ? [named.email] : splitTypedRecipients(raw);
    if (!tokens.length) return;
    const next = [...people];
    const bad: string[] = [];
    for (const t of tokens) {
      const known = contacts.find((c) => c.email.toLowerCase() === t.toLowerCase() || c.name.toLowerCase() === t.toLowerCase());
      const email = known?.email ?? t;
      if (!isEmailAddress(email)) {
        bad.push(t);
        continue;
      }
      if (!next.some((p) => p.email.toLowerCase() === email.toLowerCase())) next.push({ name: known?.name ?? '', email });
    }
    onChange(next);
    setText(bad.join(' '));
    if (bad.length) toastError('Not an email address', bad.join(', '));
  };
  const listId = `rcv-contacts-${field}`;
  return (
    <div className="flex items-start gap-2 border-b border-line-soft py-1.5">
      <label htmlFor={`rcv-rcpt-${field}`} className="w-9 flex-none pt-1.5 text-[12px] text-ink-muted">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {people.map((p, n) => (
          <span key={p.email} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface-sunken py-0.5 pl-2.5 pr-1 text-[12px]" title={p.email}>
            <span className="truncate">{p.name || p.email}</span>
            <button type="button" className="grid h-4 w-4 place-items-center rounded-full text-ink-muted hover:bg-line hover:text-ink" aria-label={`Remove ${p.name || p.email}`} onClick={() => onChange(people.filter((_, i) => i !== n))}>
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={`rcv-rcpt-${field}`}
          list={listId}
          value={text}
          placeholder={people.length ? '' : 'Add a name or any email'}
          className="h-7 min-w-[160px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          onChange={(e) => {
            const v = e.target.value;
            // A pick from the suggestions arrives as the full "Name <email>" text.
            if (contacts.some((c) => `${c.name} <${c.email}>` === v)) {
              add(v);
              return;
            }
            setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && people.length) onChange(people.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (/[,;\s]/.test(pasted.trim())) {
              e.preventDefault();
              add(pasted);
            }
          }}
        />
        <datalist id={listId}>
          {contacts.map((c) => (
            <option key={c.email} value={`${c.name} <${c.email}>`} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

/** One email of the batch: a client partner's own invoices, or the whole sheet for anyone else. */
type Draft = { key: string; kind: 'partner' | 'full'; partnerId?: string; to: EmailRecipient; cc: EmailRecipient[]; subject: string; html: string; invoiceCount: number | null };

const firstName = (r: EmailRecipient) => (r.name || r.email.split('@')[0] || 'there').trim().split(/\s+/)[0];
/** The format's greeting is "Hi Team,"; each email greets its own person. */
const greet = (html: string, r: EmailRecipient) => html.replace('<p>Hi Team,</p>', `<p>Hi ${firstName(r).replace(/[<>&"]/g, '')},</p>`);

export function ComposeSummary({
  data,
  actions: _actions,
  invoiceIds,
  onClose,
}: {
  data: ManagerSheetDto;
  actions: ReturnType<typeof useReceivablesActions>;
  /** Only these invoices (picked on the sheet); every partner gets only the picked ones they own. */
  invoiceIds?: string[];
  onClose: () => void;
}) {
  const summary = useSummary(data.sheet.id, true, invoiceIds);
  const outlook = useOutlookStatus();
  const send = useSendSummary(data.sheet.id);
  const body = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<EmailRecipient[]>([]);
  // The dialog opens with every client partner who has open invoices already picked (owner, 17 Nov 2026).
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !summary.data) return;
    prefilled.current = true;
    setPeople(summary.data.partnerDrafts.filter((p) => p.invoiceCount > 0).map((p) => ({ name: p.name, email: p.email })));
  }, [summary.data]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [active, setActive] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const s = summary.data;
  // "Your name" (owner, 18 Nov 2026): fills "Regards, <name>" in every draft; saved on the profile.
  const [sign, setSign] = useState('');
  const keepSign = useKeepSignName();
  useEffect(() => {
    if (s?.signName && !sign) setSign(s.signName);
    // Only the first load fills the box; after that it is the person's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.signName]);
  const changeSign = (name: string) => {
    setSign(name);
    if (!name.trim()) return;
    const el = body.current;
    const live = el && current ? el.innerHTML : null;
    setDrafts((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { ...v, html: withSignName(current && k === current.key && live !== null ? live : v.html, name) }])));
  };
  const isLeader = (email: string) => Boolean(s?.leaders.some((l) => l.email.toLowerCase() === email.toLowerCase()));

  const signed = (html: string) => (sign.trim() ? withSignName(html, sign) : html);
  // Each person picked gets their own draft: a partner's own invoices, or the whole sheet.
  useEffect(() => {
    if (!s) return;
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const r of people) {
        const key = r.email.toLowerCase();
        if (prev[key]) {
          next[key] = prev[key];
          continue;
        }
        const p = s.partnerDrafts.find((x) => x.email.toLowerCase() === key);
        next[key] = p
          ? { key, kind: 'partner', partnerId: p.partnerId, to: { name: p.name, email: p.email }, cc: [], subject: s.subject, html: signed(greet(p.html, { name: p.name, email: p.email })), invoiceCount: p.invoiceCount }
          : { key, kind: 'full', to: r, cc: [], subject: s.subject, html: signed(greet(s.html, r)), invoiceCount: null };
      }
      return next;
    });
    // `sign` is read when a draft is made; later changes go through changeSign.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, s]);
  const keys = people.map((r) => r.email.toLowerCase()).filter((k) => drafts[k]);
  const current = active && drafts[active] ? drafts[active] : keys.length ? drafts[keys[0]] : null;

  /** The body being edited lives in the editor; it is kept on its draft before switching or sending. */
  const keepBody = () => {
    const el = body.current;
    if (!el || !current) return;
    const html = el.innerHTML;
    setDrafts((d) => (d[current.key] ? { ...d, [current.key]: { ...d[current.key], html } } : d));
  };
  const patch = (key: string, p: Partial<Draft>) => setDrafts((d) => (d[key] ? { ...d, [key]: { ...d[key], ...p } } : d));
  const addPeople = (list: EmailRecipient[]) =>
    setPeople((prev) => {
      const seen = new Set(prev.map((r) => r.email.toLowerCase()));
      return [...prev, ...list.filter((r) => !seen.has(r.email.toLowerCase()) && (seen.add(r.email.toLowerCase()), true))];
    });

  const contacts = s?.contacts ?? [];
  const connected = outlook.data?.connected;
  const notPublished = summary.error && 'code' in summary.error && summary.error.code === 'not_published';
  // A partner with no open invoices gets nothing; every other card is sent.
  const sendable = keys.map((k) => drafts[k]).filter((d) => d.kind === 'full' || (d.invoiceCount ?? 0) > 0);
  const partnerEmails = new Set((s?.partnerDrafts ?? []).map((p) => p.email.toLowerCase()));
  const ccLeak = sendable.some((d) => d.cc.some((c) => partnerEmails.has(c.email.toLowerCase())));

  const submit = () => {
    keepSign(sign);
    const html = body.current?.innerHTML;
    const final = sendable.map((d) => (current && d.key === current.key && html !== undefined ? { ...d, html } : d));
    send.mutate(
      { emails: final.map((d) => ({ kind: d.kind, partnerId: d.partnerId, to: [d.to], cc: d.cc, subject: d.subject, html: d.html })) },
      {
        onSuccess: (r) => {
          const who = `${r.emails} email${r.emails === 1 ? '' : 's'} from ${r.from}.`;
          const toastId = `rcv-send-${r.sendId}`;
          toastLoading('Sending…', who, { id: toastId });
          onClose();
          void summarySendOutcome(data.sheet.id, r.sendId).then((o) => {
            if (o.status === 'sent') toastSuccess('Emails sent', who, { id: toastId });
            else if (o.status === 'failed') toastError('Not sent', o.error ?? undefined, { id: toastId });
            else toastInfo('Still sending', 'Check Sent Items in Outlook in a minute.', { id: toastId });
          });
        },
        onError: (e) => toastError('Not sent', e instanceof Error ? e.message : undefined),
      },
    );
  };

  const activePartners = (s?.partnerDrafts ?? []).filter((p) => p.invoiceCount > 0).map((p) => ({ name: p.name, email: p.email }));
  const lastTo = s?.lists.find((l) => l.key === 'last')?.to ?? [];

  /** Removes one person and their card; the card in view moves to the first one left. */
  const removePerson = (key: string) => {
    if (current && current.key !== key) keepBody();
    setPeople((prev) => prev.filter((r) => r.email.toLowerCase() !== key));
    if (active === key) setActive(null);
  };
  const pick = (key: string) => {
    if (current?.key === key) return;
    keepBody();
    setActive(key);
  };
  /** Up and down arrows move between the people in the list, as in any tab list. */
  const onListKey = (e: KeyboardEvent, key: string) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = keys.indexOf(key);
    const next = keys[(i + (e.key === 'ArrowDown' ? 1 : keys.length - 1)) % keys.length];
    if (!next) return;
    pick(next);
    document.getElementById(`rcv-tab-${next}`)?.focus();
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={invoiceIds?.length ? `Send email · ${invoiceIds.length} picked invoice${invoiceIds.length === 1 ? '' : 's'}` : 'Send email'}
      sub={s ? `The sheet as it is now${s.lastSentAt ? ` · ${s.lastSendStatus === 'failed' ? 'last send failed' : s.lastSendStatus === 'sending' ? 'sending since' : 'last sent'} ${stamp(s.lastSentAt)}` : ''}` : undefined}
      size="xl"
      flush
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!s || !connected || !sendable.length || ccLeak || sendable.some((d) => !d.subject.trim()) || send.isPending}>
            {send.isPending ? 'Sending…' : `Send ${sendable.length || ''} email${sendable.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          </Button>
        </>
      }
    >
      {notPublished ? (
        <p className="p-3 text-[13px] text-ink-muted">Click Update once first to set the sheet up for email.</p>
      ) : summary.isLoading ? (
        <p className="p-3 text-[13px] text-ink-muted">Preparing the email…</p>
      ) : summary.error ? (
        <p className="p-3 text-[13px] text-danger">{summary.error.message}</p>
      ) : s ? (
        <div className="text-[13px]">
          {outlook.data && !connected ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-info-soft px-3 py-1 text-[12.5px] text-info">
              <span className="min-w-0 flex-1">The email sends from your own Outlook. Connect it once.</span>
              <a href={OUTLOOK_CONNECT_HREF} className="font-medium underline underline-offset-2 hover:no-underline">
                Connect Outlook
              </a>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 border-b border-line-soft px-3 py-1.5 text-[12.5px] text-ink-muted">
            <span className="min-w-0 truncate">
              From <b className="font-medium text-ink">{connected ? outlook.data?.msEmail : 'your Outlook'}</b>
            </span>
            <span className="mr-auto">
              <SignNameField id="rcv-sign-name" value={sign} onChange={changeSign} />
            </span>
            <span className="text-[12px]">Add</span>
            <Button size="sm" variant="secondary" className="h-7 px-2 text-[12.5px]" disabled={!activePartners.length} onClick={() => addPeople(activePartners)}>
              All partners
            </Button>
            <Button size="sm" variant="secondary" className="h-7 px-2 text-[12.5px]" disabled={!s.leaders.length} onClick={() => addPeople(s.leaders)}>
              All leaders
            </Button>
            {lastTo.length ? (
              <Button size="sm" variant="quiet" className="h-7 px-2 text-[12.5px]" onClick={() => addPeople(lastTo)}>
                Same as last time
              </Button>
            ) : null}
          </div>

          <div className="grid md:grid-cols-[240px_minmax(0,1fr)]">
            {/* The left pane: everyone picked, one email each. On a phone it sits on top and folds away. */}
            <div className="flex min-w-0 flex-col border-b border-line-soft md:border-b-0 md:border-r">
              <button
                type="button"
                className="flex items-center justify-between px-3 py-1.5 text-[12.5px] font-medium text-ink-2 md:hidden"
                aria-expanded={listOpen}
                aria-controls="rcv-people"
                onClick={() => setListOpen((o) => !o)}
              >
                <span>
                  {keys.length} {keys.length === 1 ? 'person' : 'people'}
                </span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', listOpen && 'rotate-180')} aria-hidden />
              </button>
              <div id="rcv-people" className={cn('flex min-h-0 flex-col', !listOpen && 'max-md:hidden')}>
                {keys.length ? (
                  <div role="tablist" aria-label="Emails" aria-orientation="vertical" className="max-h-[30vh] overflow-y-auto p-1.5 md:max-h-[52vh]">
                    {keys.map((k) => {
                      const d = drafts[k];
                      const on = current?.key === k;
                      const empty = d.kind === 'partner' && !d.invoiceCount;
                      const label = empty ? 'no open invoices, not sent' : d.kind === 'partner' ? `partner · ${d.invoiceCount} open` : isLeader(d.to.email) ? 'leader · whole sheet' : 'whole sheet';
                      const who = d.to.name || d.to.email;
                      return (
                        <div key={k} className={cn('group flex items-center rounded-md', on ? 'bg-brand-soft' : 'hover:bg-hover', empty && 'opacity-60')}>
                          <button
                            id={`rcv-tab-${k}`}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            aria-controls="rcv-card"
                            tabIndex={on ? 0 : -1}
                            title={d.to.email}
                            onClick={() => pick(k)}
                            onKeyDown={(e) => onListKey(e, k)}
                            className={cn('flex min-w-0 flex-1 items-baseline gap-2 rounded-md border-l-2 px-2 py-1 text-left', on ? 'border-brand' : 'border-transparent')}
                          >
                            <span className={cn('truncate text-[13px] text-ink', on && 'font-medium')}>{who}</span>
                            <span className="ml-auto flex-none text-[11.5px] text-ink-muted">{label}</span>
                          </button>
                          <button
                            type="button"
                            className="mr-1 grid h-5 w-5 flex-none place-items-center rounded text-ink-muted hover:bg-line hover:text-ink"
                            aria-label={`Remove ${who}`}
                            onClick={() => removePerson(k)}
                          >
                            <X className="h-3 w-3" aria-hidden />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-[12.5px] text-ink-muted">Add a client partner, a leader or any address. Each person gets an email of their own.</p>
                )}
                <div className="border-t border-line-soft px-2 [&>div]:border-b-0">
                  <RecipientRow field="to" label="Add" people={[]} contacts={contacts} onChange={addPeople} />
                </div>
              </div>
            </div>

            {/* The right pane: the card in view, with its own Cc, subject and editable body. */}
            {current ? (
              <div key={current.key} id="rcv-card" role="tabpanel" aria-labelledby={`rcv-tab-${current.key}`} className="grid min-w-0 content-start gap-1.5 p-3">
                <div className="truncate text-[12.5px] text-ink-muted" title={current.to.email}>
                  <span className="inline-block w-9">To</span>
                  <b className="font-medium text-ink">{current.to.name ? `${current.to.name} <${current.to.email}>` : current.to.email}</b>
                  {current.kind === 'partner' ? ' · only this partner’s clients' : ' · the whole sheet'}
                </div>
                <RecipientRow field="cc" label="Cc" people={current.cc} contacts={contacts.filter((c) => !partnerEmails.has(c.email.toLowerCase()))} onChange={(cc) => patch(current.key, { cc })} />
                {current.cc.some((c) => partnerEmails.has(c.email.toLowerCase())) ? (
                  <p role="alert" className="text-[12.5px] text-danger">
                    A client partner cannot be in Cc: they would see invoices that are not theirs. Remove them.
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  <label htmlFor="rcv-subject" className="flex-none text-[12px] text-ink-muted">
                    Subject
                  </label>
                  <Input id="rcv-subject" className="h-8 px-2 py-1 text-[13px]" value={current.subject} maxLength={200} onChange={(e) => patch(current.key, { subject: e.target.value })} />
                </div>
                <div
                  ref={body}
                  role="textbox"
                  aria-multiline="true"
                  aria-label={`Email to ${current.to.name || current.to.email}`}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={keepBody}
                  className="max-h-[56vh] min-h-[340px] overflow-auto rounded-md border border-line-strong bg-white p-3 text-[13px] text-black outline-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 focus:border-brand focus:ring-4 focus:ring-focus-ring/25"
                  dangerouslySetInnerHTML={{ __html: current.html }}
                />
              </div>
            ) : (
              <p className="p-3 text-[12.5px] text-ink-muted">One email per person. A client partner gets only the invoices of their own clients; a leader gets the whole sheet.</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
