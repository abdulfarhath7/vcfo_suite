'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { withSignName } from '@/lib/receivables/sign-name';
import { alreadySentHits } from '@/lib/receivables/sent-receipts';
import { emailRows, summaryEmailHtml } from '@/lib/receivables/summary-email';
import { InvoicesInEmail } from './compose/InvoicesInEmail';
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
 * Send email: the summary in the finance team's format, built from the live sheet, sent from the
 * sender's own Outlook (owner, 17 Nov 2026). Each card is one email: a client partner gets their own,
 * holding only the invoices of their own clients; the leaders share one email with all of them in To,
 * so each leader sees who else got it (owner, 19 Nov 2026); anyone else gets the whole sheet on their
 * own card. Each card has its own Cc, subject and editable body. An invoice removed with ✕ leaves
 * every email of the send. A client partner is never allowed in Cc or in the leaders' To. No Excel
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
type Draft = {
  key: string;
  kind: 'partner' | 'full';
  partnerId?: string;
  /** One person, or every leader on the leaders' card. */
  to: EmailRecipient[];
  cc: EmailRecipient[];
  subject: string;
  html: string;
  invoiceCount: number | null;
  slug?: string;
  alsoClientKeys?: string[];
};

const firstName = (r: EmailRecipient) => (r.name || r.email.split('@')[0] || 'there').trim().split(/\s+/)[0];
/** The format's greeting is "Hi Team,"; each email greets its own person. */
/** The key of the one email all the leaders share. */
const LEADERS = 'leaders';
const lower = (e: string) => e.toLowerCase();
const greet = (html: string, r: EmailRecipient) => html.replace(/<p( style="[^"]*")?>Hi Team,<\/p>/, (_m, style = '') => `<p${style}>Hi ${firstName(r).replace(/[<>&"]/g, '')},</p>`);

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
  const isLeader = (email: string) => Boolean(s?.leaders.some((l) => lower(l.email) === lower(email)));
  const partnerEmails = new Set((s?.partnerDrafts ?? []).map((p) => lower(p.email)));
  // Invoices taken out of every email of this send (owner, 19 Nov 2026); the sheet does not change.
  const [removed, setRemoved] = useState<string[]>([]);
  // People added to the leaders' email by hand; a client partner never joins it.
  const [joined, setJoined] = useState<string[]>([]);
  const inGroup = (email: string) => !partnerEmails.has(lower(email)) && (isLeader(email) || joined.includes(lower(email)));

  const signed = (html: string) => (sign.trim() ? withSignName(html, sign) : html);
  /** The body of one email, rebuilt from the live rows without the removed invoices. */
  const bodyFor = (d: Pick<Draft, 'key' | 'to' | 'slug' | 'alsoClientKeys'>, out: string[]) => {
    if (!s) return '';
    const html = summaryEmailHtml({
      rows: s.rows.filter((r) => !out.includes(r.id)),
      today: s.today,
      liveUrl: '',
      signerName: sign.trim() || s.signName || '',
      partnerSlug: d.slug,
      alsoClientKeys: d.alsoClientKeys,
      picked: s.picked,
    });
    // The leaders' email keeps "Hi Team,"; every other email greets its own person.
    return signed(d.key === LEADERS || !d.to[0] ? html : greet(html, d.to[0]));
  };
  // A card per partner and per other person, and one card for every leader together.
  useEffect(() => {
    if (!s) return;
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      const group = people.filter((r) => inGroup(r.email));
      if (group.length) {
        const base = { key: LEADERS, to: group };
        next[LEADERS] = prev[LEADERS] ? { ...prev[LEADERS], to: group } : { ...base, kind: 'full', cc: [], subject: s.subject, html: bodyFor(base, removed), invoiceCount: null };
      }
      for (const r of people) {
        const key = lower(r.email);
        if (inGroup(r.email)) continue;
        if (prev[key]) {
          next[key] = prev[key];
          continue;
        }
        const p = s.partnerDrafts.find((x) => lower(x.email) === key);
        const to = [p ? { name: p.name, email: p.email } : r];
        const shape = { key, to, slug: p?.slug, alsoClientKeys: p?.alsoClientKeys };
        next[key] = p
          ? { ...shape, kind: 'partner', partnerId: p.partnerId, cc: [], subject: s.subject, html: bodyFor(shape, removed), invoiceCount: p.invoiceCount }
          : { ...shape, kind: 'full', cc: [], subject: s.subject, html: bodyFor(shape, removed), invoiceCount: null };
      }
      return next;
    });
    // `sign` and `removed` are read when a card is made; later changes go through changeSign and toggleInvoice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, s, joined]);
  const keys = [LEADERS, ...people.filter((r) => !inGroup(r.email)).map((r) => lower(r.email))].filter((k) => drafts[k]);
  /** The invoices an email holds (removed ones included), the ones it still holds, and its already-sent ones. */
  const draftRows = (d: Draft) => (s ? emailRows({ rows: s.rows, today: s.today, partnerSlug: d.slug, alsoClientKeys: d.alsoClientKeys, picked: s.picked }) : []);
  const keptIds = (d: Draft) => draftRows(d).filter((r) => !removed.includes(r.id)).map((r) => r.id);
  const hitsOf = (d: Draft) => (s ? alreadySentHits(s.alreadySent, keptIds(d), [...d.to, ...d.cc].map((c) => c.email)) : []);
  /** ✕ or put back: the invoice leaves (or rejoins) every email that holds it; those bodies are rebuilt. */
  const toggleInvoice = (id: string) => {
    if (!s) return;
    const out = removed.includes(id) ? removed.filter((x) => x !== id) : [...removed, id];
    setRemoved(out);
    setDrafts((all) => Object.fromEntries(Object.entries(all).map(([k, v]) => [k, draftRows(v).some((r) => r.id === id) ? { ...v, html: bodyFor(v, out) } : v])));
  };
  /** The leaders' To: a person taken out leaves the send; a person added joins this email. */
  const changeGroup = (next: EmailRecipient[]) => {
    const partners = next.filter((r) => partnerEmails.has(lower(r.email)));
    if (partners.length) toastError('A client partner cannot be on the leaders’ email', 'They would see invoices that are not theirs. They get their own email.');
    const list = next.filter((r) => !partnerEmails.has(lower(r.email)));
    const keep = new Set(list.map((r) => lower(r.email)));
    const dropped = (current?.to ?? []).filter((r) => !keep.has(lower(r.email))).map((r) => lower(r.email));
    setJoined(list.filter((r) => !isLeader(r.email)).map((r) => lower(r.email)));
    setPeople((prev) => {
      const left = prev.filter((r) => !dropped.includes(lower(r.email)));
      const seen = new Set(left.map((r) => lower(r.email)));
      return [...left, ...list.filter((r) => !seen.has(lower(r.email)))];
    });
  };
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
  const sendable = keys.map((k) => drafts[k]).filter((d) => keptIds(d).length > 0 || (d.kind === 'full' && !removed.length && !s?.picked));
  const blocked = sendable.flatMap(hitsOf);
  const ccLeak = sendable.some((d) => d.cc.some((c) => partnerEmails.has(c.email.toLowerCase())));

  const submit = () => {
    keepSign(sign);
    const html = body.current?.innerHTML;
    const final = sendable.map((d) => (current && d.key === current.key && html !== undefined ? { ...d, html } : d));
    send.mutate(
      { emails: final.map((d) => ({ kind: d.kind, partnerId: d.partnerId, to: d.to, cc: d.cc, subject: d.subject, html: d.html, invoiceIds: keptIds(d) })) },
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
    const gone = key === LEADERS ? new Set((drafts[LEADERS]?.to ?? []).map((r) => lower(r.email))) : new Set([key]);
    if (key === LEADERS) setJoined([]);
    setPeople((prev) => prev.filter((r) => !gone.has(lower(r.email))));
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
          <Button onClick={submit} disabled={!s || !connected || !sendable.length || ccLeak || blocked.length > 0 || sendable.some((d) => !d.subject.trim()) || send.isPending}>
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
                      const n = keptIds(d).length;
                      const warn = hitsOf(d).length;
                      const empty = !sendable.includes(d);
                      const label = warn
                        ? `⚠ ${warn} already sent`
                        : empty
                          ? 'nothing to send'
                          : d.kind === 'partner'
                            ? `partner · ${n} invoice${n === 1 ? '' : 's'}`
                            : `${k === LEADERS ? `${d.to.length} in To` : 'everyone'} · ${n} invoice${n === 1 ? '' : 's'}`;
                      const who = k === LEADERS ? `Leaders: ${d.to.map((r) => firstName(r)).join(', ')}` : d.to[0].name || d.to[0].email;
                      return (
                        <div key={k} className={cn('group flex items-center rounded-md', on ? 'bg-brand-soft' : 'hover:bg-hover', empty && 'opacity-60')}>
                          <button
                            id={`rcv-tab-${k}`}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            aria-controls="rcv-card"
                            tabIndex={on ? 0 : -1}
                            title={d.to.map((r) => r.email).join(', ')}
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
                  <p className="px-3 py-2 text-[12.5px] text-ink-muted">Add a client partner, a leader or any address. Partners get their own email; the leaders share one.</p>
                )}
                <div className="border-t border-line-soft px-2 [&>div]:border-b-0">
                  <RecipientRow field="to" label="Add" people={[]} contacts={contacts} onChange={addPeople} />
                </div>
              </div>
            </div>

            {/* The right pane: the card in view, with its own Cc, subject and editable body. */}
            {current ? (
              <div key={current.key} id="rcv-card" role="tabpanel" aria-labelledby={`rcv-tab-${current.key}`} className="grid min-w-0 content-start gap-1.5 p-3">
                {current.key === LEADERS ? (
                  <>
                    <RecipientRow field="to" label="To" people={current.to} contacts={contacts.filter((c) => !partnerEmails.has(lower(c.email)))} onChange={changeGroup} />
                    <p className="text-[12px] text-ink-muted">One email to every leader · the whole sheet. Each leader sees who else got it.</p>
                  </>
                ) : (
                  <div className="truncate text-[12.5px] text-ink-muted" title={current.to[0].email}>
                    <span className="inline-block w-9">To</span>
                    <b className="font-medium text-ink">{current.to[0].name ? `${current.to[0].name} <${current.to[0].email}>` : current.to[0].email}</b>
                    {current.kind === 'partner' ? ' · only this partner’s clients' : ' · the whole sheet'}
                  </div>
                )}
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
                <InvoicesInEmail everyEmail rows={draftRows(current)} removed={removed} hits={hitsOf(current)} onToggle={toggleInvoice} />
                {hitsOf(current).length ? (
                  <p role="alert" className="text-[12.5px] text-warning">
                    {`${hitsOf(current).length} received invoice${hitsOf(current).length === 1 ? ' was' : 's were'} already sent to this person. Remove ${hitsOf(current).length === 1 ? 'it' : 'them'} to send.`}
                  </p>
                ) : null}
                <div
                  ref={body}
                  role="textbox"
                  aria-multiline="true"
                  aria-label={`Email to ${current.to.map((r) => r.name || r.email).join(', ')}`}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={keepBody}
                  className="max-h-[56vh] min-h-[340px] overflow-auto rounded-md border border-line-strong bg-white p-3 text-[13px] text-black outline-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 focus:border-brand focus:ring-4 focus:ring-focus-ring/25"
                  dangerouslySetInnerHTML={{ __html: current.html }}
                />
              </div>
            ) : (
              <p className="p-3 text-[12.5px] text-ink-muted">A client partner gets their own email with only their clients’ invoices. The leaders share one email with the whole sheet.</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
