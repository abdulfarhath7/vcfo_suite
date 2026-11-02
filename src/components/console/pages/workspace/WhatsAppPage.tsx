'use client';

/**
 * WHATSAPP — /app/manager/whatsapp and /app/intern/whatsapp. The Email page's
 * pair: one person, one approved template, its fields, a phone-style preview,
 * Send. WhatsApp is an outbound nudge only; email stays the record.
 *   GET  /api/whatsapp/recipients  people in the sender's scope + WhatsApp state, configured?
 *   POST /api/whatsapp/send        one template to one person, recorded in notification_deliveries
 *   GET  /api/whatsapp/sends       recent WhatsApp messages on the sender's clients
 *   POST …/notification-deliveries/:id/retry   (managers and admins, failed rows)
 * Only people with a WhatsApp number and consent can be picked; no free numbers.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DirectoryProject } from '@/lib/email/directory-filter';
import { MANUAL_TEMPLATES, STATE_TEXT, checkManualSend, fieldLabel, manualTemplate, renderTemplateBody, type ManualTemplate, type TemplateField } from '@/lib/notify/manual-send';
import { firstNameOf } from '@/lib/notify/templates';
import type { NotifyVariables } from '@/lib/notify/types';
import { skipReasonText, whatsappErrorText } from '@/lib/notify/whatsapp-error-text';
import { errorMessage } from '@/lib/toast-errors';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, Icon } from '../../ui';
import { dayLabel, plural, timeLabel } from './model';
import { ErrorLine, PanelLoading, fetchJson } from './shared';

type Person = {
  userId: string;
  name: string;
  email: string;
  kind: 'firm' | 'client';
  projects: DirectoryProject[];
  phoneMasked: string;
  state: 'ready' | 'no_phone' | 'no_consent' | 'opted_out';
};
type Recipients = { configured: boolean; canRetry: boolean; people: Person[] };
type SendRow = {
  id: string;
  eventType: string;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  createdAt: string;
  engagementId: string | null;
  companyName: string | null;
  retryOf: string | null;
};

const SENDS_KEY = ['whatsapp', 'sends'] as const;

const WHY_NOT: Record<Exclude<Person['state'], 'ready'>, string> = {
  no_phone: 'They add a WhatsApp number in their own Settings → Profile.',
  no_consent: 'They tick “Send me WhatsApp updates” in their own Settings → Profile.',
  opted_out: 'They replied STOP. Ticking consent again in their Settings turns it back on.',
};

const SEND_ERROR: Record<string, string> = {
  not_in_scope: 'This person is not on your clients or team.',
  too_soon: 'You just messaged this person. Wait a few seconds before sending again.',
  missing_field: 'Fill every field of the template.',
  unknown_template: 'That template is not one of the approved ones.',
  account_not_found: 'This person’s account was not found.',
};

function statusPill(r: SendRow): { cls: string; text: string; tip: string } {
  if (r.status === 'failed') return { cls: 'over', text: 'Failed', tip: whatsappErrorText(r.errorCode) };
  if (r.status === 'skipped') return { cls: 'mut', text: 'Not sent', tip: skipReasonText(r.skipReason) ?? 'Skipped' };
  if (r.status === 'read') return { cls: 'done', text: 'Read', tip: 'Read on WhatsApp' };
  if (r.status === 'delivered') return { cls: 'done', text: 'Delivered', tip: 'Delivered to the phone' };
  return { cls: 'up', text: 'Sent', tip: 'Handed to WhatsApp; waiting for delivery' };
}

export function WhatsAppPage() {
  useCrumbs(['WhatsApp']);
  const { toast } = useConsole();
  const qc = useQueryClient();
  const recQ = useQuery({ queryKey: ['whatsapp', 'recipients'], queryFn: () => fetchJson<Recipients>('/api/whatsapp/recipients'), staleTime: 60_000 });
  const sendsQ = useQuery({ queryKey: SENDS_KEY, queryFn: async () => (await fetchJson<{ sends?: SendRow[] }>('/api/whatsapp/sends')).sends ?? [] });
  const people = useMemo(() => recQ.data?.people ?? [], [recQ.data]);
  const configured = recQ.data?.configured ?? false;

  const [tpl, setTpl] = useState<ManualTemplate>(MANUAL_TEMPLATES[0]!);
  const [personId, setPersonId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [vars, setVars] = useState<NotifyVariables>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'due' | 'over'; title: string; text: string } | null>(null);
  const person = people.find((p) => p.userId === personId) ?? null;
  const project = person?.projects.find((p) => p.id === projectId) ?? person?.projects[0] ?? null;

  /* prefill what the app knows: the person's first name and the company */
  useEffect(() => {
    if (!person) return;
    setVars((v) => ({ ...v, firstName: firstNameOf(person.name), companyName: project?.companyName ?? v.companyName ?? '' }));
  }, [person, project]);

  const check = checkManualSend(tpl.event, vars as Record<string, unknown>);
  const canSend = configured && person?.state === 'ready' && check.ok && !sending;

  const send = async () => {
    if (!person) return;
    setResult(null);
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: person.userId, event: tpl.event, variables: vars, engagementId: project?.id ?? null }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; reason?: string; error?: string; errorCode?: string };
      if (json.ok) {
        toast(`WhatsApp sent to ${person.name}`);
        setResult({ tone: 'ok', title: 'Sent', text: `${tpl.label} went to ${person.name}. Delivery shows in the list below as WhatsApp reports it.` });
      } else if (json.status === 'skipped') {
        setResult({ tone: 'due', title: 'Not sent', text: skipReasonText(json.reason) ?? 'WhatsApp skipped this message.' });
      } else if (json.status === 'failed') {
        setResult({ tone: 'over', title: 'WhatsApp did not send it', text: whatsappErrorText(json.errorCode) });
      } else {
        setResult({ tone: 'over', title: 'Not sent', text: SEND_ERROR[json.error ?? ''] ?? errorMessage(json.error ?? 'send_failed') });
      }
    } catch (e) {
      setResult({ tone: 'over', title: 'Not sent', text: errorMessage(e) });
    } finally {
      setSending(false);
      void qc.invalidateQueries({ queryKey: SENDS_KEY });
    }
  };

  return (
    <>
      <div className="sec-h">
        <h2>WhatsApp</h2>
        <span className="sec-count">{recQ.isPending ? 'Checking WhatsApp…' : configured ? 'WhatsApp ready' : 'WhatsApp not set up'}</span>
      </div>

      <div className="mx-tgal" role="group" aria-label="Approved templates">
        {MANUAL_TEMPLATES.map((t) => (
          <button key={t.event} type="button" className={'glass mx-tcard' + (t.event === tpl.event ? ' on' : '')} aria-pressed={t.event === tpl.event} title={t.body} onClick={() => setTpl(t)}>
            <span className="mx-ni">
              <Icon name={t.audience === 'firm' ? 'team' : 'phone'} />
            </span>
            <b className="ws-ell">{t.label}</b>
            <span>{t.audience === 'firm' ? 'To the team' : 'To a client'}</span>
          </button>
        ))}
      </div>

      {recQ.isPending ? (
        <PanelLoading label="Loading people…" />
      ) : recQ.isError ? (
        <section className="glass panel mx-p">
          <ErrorLine text={`Could not load people · ${errorMessage(recQ.error)}`} onRetry={() => void recQ.refetch()} />
        </section>
      ) : (
        <div className="mx-row11">
          <section className="glass panel mx-compose">
            <div className="ph">
              <div className="mx-pt">
                <h3>New WhatsApp message</h3>
                <span className="small">One person · an approved template · email stays the record</span>
              </div>
            </div>
            {!configured ? (
              <div className="banner due ws-banner">
                <Icon name="alert" />
                <div>
                  <b>WhatsApp is not set up on this server</b>
                  <span>No WhatsApp sender number is configured (EUM phone number id), so nothing can be sent from here. Email is not affected.</span>
                </div>
              </div>
            ) : null}
            <PersonPicker people={people} value={personId} onPick={(id) => { setPersonId(id); setProjectId(''); setResult(null); }} />
            {person && person.projects.length > 1 ? (
              <div className="mx-mrow">
                <label className="mx-fl" htmlFor="ws-wa-co">
                  About
                </label>
                <select id="ws-wa-co" className="lsel" value={project?.id ?? ''} onChange={(e) => setProjectId(e.target.value)}>
                  {person.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.companyName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="mx-form2 ws-wa-fields">
              {tpl.fields.map((f: TemplateField) => (
                <label key={f} className="mx-f">
                  <span className="mx-fl">{fieldLabel(tpl.event, f)}</span>
                  <input className="mx-in" value={vars[f] ?? ''} maxLength={120} placeholder={f === 'dueDate' ? 'e.g. 20 Nov' : undefined} onChange={(e) => setVars((v) => ({ ...v, [f]: e.target.value }))} />
                </label>
              ))}
            </div>
            {result ? (
              <div className={'banner ws-banner ' + (result.tone === 'ok' ? 'ok' : result.tone)} role="status">
                <Icon name={result.tone === 'ok' ? 'check' : 'alert'} />
                <div>
                  <b>{result.title}</b>
                  <span>{result.text}</span>
                </div>
              </div>
            ) : null}
            <div className="mx-mfoot">
              <span className="small">
                {!person ? 'Pick a person' : person.state !== 'ready' ? STATE_TEXT[person.state] : check.ok === false ? `Fill ${fieldLabel(tpl.event, check.field ?? 'companyName')}` : `To ${person.name} · ${person.phoneMasked}`}
              </span>
              <span className="sp" />
              <Btn cls="pri" ico="send" disabled={!canSend} title={!configured ? 'WhatsApp is not set up on this server' : undefined} onClick={() => void send()}>
                {sending ? 'Sending…' : 'Send'}
              </Btn>
            </div>
          </section>

          <section className="glass panel mx-eprev">
            <div className="ph">
              <div className="mx-pt">
                <h3>How it arrives</h3>
                <span className="small">{`Approved template · ${tpl.event}`}</span>
              </div>
            </div>
            <div className="ws-wa-phone">
              <div className="ws-wa-top">
                <b>SBC</b>
                <span>{person ? `to ${person.name}` : 'WhatsApp'}</span>
              </div>
              <div className="ws-wa-chat">
                <div className="ws-wa-bubble">
                  {renderTemplateBody(tpl, vars)}
                  <em>{timeLabel(new Date().toISOString())}</em>
                </div>
              </div>
            </div>
            <p className="small ws-wa-note">Words in [brackets] are fields still empty. The wording is fixed by the approved template; only the fields change.</p>
          </section>
        </div>
      )}

      <SentList rows={sendsQ.data ?? []} loading={sendsQ.isPending} failed={sendsQ.isError} onRetryLoad={() => void sendsQ.refetch()} canRetry={recQ.data?.canRetry ?? false} />
    </>
  );
}

/* ---------------------------------------------------------------- one person */

function PersonPicker({ people, value, onPick }: { people: Person[]; value: string | null; onPick: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const chosen = people.find((p) => p.userId === value) ?? null;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const hit = people.filter((p) => !t || `${p.name} ${p.email} ${p.projects.map((x) => x.companyName).join(' ')}`.toLowerCase().includes(t));
    return [...hit].sort((a, b) => Number(b.state === 'ready') - Number(a.state === 'ready') || a.name.localeCompare(b.name));
  }, [people, q]);
  const ready = people.filter((p) => p.state === 'ready').length;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className="mx-mrow" ref={rowRef}>
      <label className="mx-fl" htmlFor="ws-wa-to">
        To
      </label>
      <div className="mx-tos">
        {chosen ? (
          <span className="pill mut ws-chip" title={`${chosen.name} · ${chosen.email}`}>
            <span className="ws-ell">{`${chosen.name} · ${chosen.phoneMasked}`}</span>
            <button type="button" aria-label={`Remove ${chosen.name}`} onClick={() => onPick(null)}>
              <Icon name="x" size={11} />
            </button>
          </span>
        ) : null}
        <input
          id="ws-wa-to"
          className="mx-in grow"
          role="combobox"
          aria-expanded={open}
          aria-controls="ws-wa-list"
          autoComplete="off"
          value={q}
          placeholder={chosen ? 'Change the person…' : `Search ${plural(ready, 'person', 'people')} with WhatsApp on…`}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </div>
      <div id="ws-wa-list" className="mx-sugg ws-sugg" role="listbox" aria-label="People" hidden={!open}>
        {!list.length ? (
          <p className="small ws-sline">No one matches. Only your clients’ contacts and your team are here.</p>
        ) : (
          list.map((p) => {
            const ok = p.state === 'ready';
            return (
              <button
                key={p.userId}
                type="button"
                role="option"
                aria-selected={p.userId === value}
                aria-disabled={!ok}
                className={'mx-mi' + (p.userId === value ? ' on' : '') + (ok ? '' : ' ws-off')}
                title={ok ? undefined : `${STATE_TEXT[p.state]} · ${WHY_NOT[p.state]}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!ok) return;
                  onPick(p.userId);
                  setQ('');
                  setOpen(false);
                }}
              >
                <span className="mx-mt">
                  <b className="ws-ell">{`${p.name}${p.kind === 'client' ? '' : ' · team'}`}</b>
                  <span className="ws-ell">{ok ? `${p.phoneMasked} · ${p.projects.map((x) => x.companyName).join(', ') || p.email}` : `${STATE_TEXT[p.state]} · ${WHY_NOT[p.state]}`}</span>
                </span>
                {ok ? <Icon name="phone" /> : <Icon name="lock" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sent */

function SentList({ rows, loading, failed, onRetryLoad, canRetry }: { rows: SendRow[]; loading: boolean; failed: boolean; onRetryLoad: () => void; canRetry: boolean }) {
  const { toast } = useConsole();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const retry = async (r: SendRow) => {
    if (!r.engagementId) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(r.engagementId)}/notification-deliveries/${r.id}/retry`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error === 'not_retryable' ? 'This message cannot be retried.' : json.error || 'retry_failed');
      toast('Queued again · it shows here once WhatsApp answers');
      void qc.invalidateQueries({ queryKey: SENDS_KEY });
    } catch (e) {
      toast(`Retry failed · ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="glass panel mx-p">
      <div className="ph">
        <div className="mx-pt">
          <h3>Sent</h3>
          <span className="small">Recent WhatsApp messages on your clients, from this page and the automatic updates</span>
        </div>
      </div>
      {loading ? (
        <div className="sec-load">Loading messages…</div>
      ) : failed ? (
        <ErrorLine text="Could not load the sent messages." onRetry={onRetryLoad} />
      ) : !rows.length ? (
        <div className="mx-empty">
          <Icon name="phone" />
          <b>No WhatsApp messages yet</b>
          <span>Messages to your clients and team appear here with their delivery status.</span>
        </div>
      ) : (
        rows.map((r) => {
          const pill = statusPill(r);
          return (
            <div key={r.id} className="mx-sentr ws-wa-row">
              <Icon name="send" />
              <span className="mx-dt">
                <b className="ws-ell">{`${manualTemplate(r.eventType)?.label ?? r.eventType} · ${r.recipientName ?? r.recipientEmail ?? 'someone'}`}</b>
                <span className="ws-ell">{`${r.companyName ?? ''}${r.companyName ? ' · ' : ''}${dayLabel(r.createdAt)}, ${timeLabel(r.createdAt)}${r.retryOf ? ' · retry' : ''}${r.status === 'failed' || r.status === 'skipped' ? ` · ${pill.tip}` : ''}`}</span>
              </span>
              <span className={'pill sm ' + pill.cls} title={pill.tip}>
                {pill.text}
              </span>
              {canRetry && r.status === 'failed' && r.engagementId ? (
                <Btn cls="sm" ico="send" disabled={busy === r.id} onClick={() => void retry(r)}>
                  {busy === r.id ? 'Retrying…' : 'Retry'}
                </Btn>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}
