'use client';

/**
 * EMAIL — /app/manager/mail and /app/intern/mail (prototype mxRenderers.email,
 * a59r + the a59s layout: templates as a gallery, the message beside how it
 * arrives). The live compose page (src/views/staff/ComposeMail.tsx) in the
 * console's look, same data and same send:
 *   From   the signed-in person's Outlook mailbox (GET /api/outlook); not
 *          connected → says so, points to Settings, Send stays off
 *   To     RecipientPicker (directory GET /api/outlook/directory, typed
 *          addresses, Team / Client pickers)
 *   Templates  email-templates.tsx (DB-backed, SBC branded or plain)
 *   Send   POST /api/outlook/send { to, subject, text, branding, templateId }
 *   Prefill ?to=&subject=&body= (Today reminders, Ask VCFO, Email manager) and
 *          ?template= (search). Nothing is sent until Send is pressed.
 * "How it arrives" renders the exact HTML the server builds
 * (wrapComposeBodyHtml) in a sandboxed frame.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { emailBrandingLabel, htmlFromPlainText, wrapComposeBodyHtml, type EmailTemplateDto } from '@/lib/email/compose-branding';
import { matchDirectoryPersonByToParam, type DirectoryPerson } from '@/lib/email/directory-filter';
import { isEmailAddress } from '@/lib/email/recipient-input';
import { engagementIdAliases } from '@/lib/legacy-engagement-ids';
import { errorMessage } from '@/lib/toast-errors';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Btn, Icon } from '../../ui';
import { stageOf } from '../clients/model';
import { applyAutoFill, parseSent, pushSent, readComposeParams, recipientsOf, timeLabel, type SentEntry } from './model';
import { PanelLoading, fetchJson, useSettled } from './shared';
import { RecipientPicker } from './email-to';
import { TemplateGallery, useEmailTemplates } from './email-templates';

type Status = { configured: boolean; connected: boolean; msEmail?: string };

const SEND_CODES: Record<string, string> = {
  outlook_not_configured: 'Outlook is not set up for this app yet.',
  template_not_found: 'That template no longer exists. Pick another or write without one.',
  body_required: 'Write a message before sending.',
};

export function EmailPage() {
  useCrumbs(['Email']);
  return (
    <Suspense
      fallback={
        <>
          <div className="sec-h">
            <h2>Email</h2>
            <span className="sec-count">Checking Outlook…</span>
          </div>
          <PanelLoading label="Loading the compose page…" />
        </>
      }
    >
      <Compose />
    </Suspense>
  );
}

function Compose() {
  const { base, go, toast, scope, me } = useConsole();
  const { engagements, getStateForEngagement } = useApp();
  const params = useSearchParams();
  const pre = useMemo(() => readComposeParams(params), [params]);

  /* ---------- data */
  const statusQ = useQuery({
    queryKey: ['outlook', 'status'],
    queryFn: async (): Promise<Status> => {
      const json = await fetchJson<{ configured?: boolean; connected?: boolean; msEmail?: string }>('/api/outlook');
      return { configured: json.configured !== false, connected: Boolean(json.connected), msEmail: json.msEmail };
    },
    retry: false,
  });
  const peopleQ = useQuery({
    queryKey: ['outlook', 'directory'],
    queryFn: async (): Promise<DirectoryPerson[]> => (await fetchJson<{ people?: DirectoryPerson[] }>('/api/outlook/directory')).people ?? [],
    staleTime: 60_000,
  });
  const templatesQ = useEmailTemplates();
  const people = useMemo(() => peopleQ.data ?? [], [peopleQ.data]);
  const loadingStatus = statusQ.isPending;
  // live: a failed status check reads as "not connected" (configured stays true)
  const configured = statusQ.data?.configured ?? true;
  const connected = statusQ.data?.connected ?? false;
  const msEmail = statusQ.data?.msEmail;

  /* ---------- the draft */
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [applied, setApplied] = useState<EmailTemplateDto | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<{ title: string; text: string } | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const applyTemplate = useCallback((t: EmailTemplateDto) => {
    setApplied(t);
    setSubject(t.subject);
    setBody(t.bodyText);
  }, []);
  const clearTemplate = useCallback(() => setApplied(null), []);

  /* ---------- prefill (subject / body as soon as they are in the URL; `to` once the directory is in) */
  const preKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${pre.subject ?? ''}\u0000${pre.body ?? ''}`;
    if (preKey.current === key) return;
    preKey.current = key;
    if (pre.subject) setSubject(pre.subject);
    if (pre.body) setBody(pre.body);
  }, [pre.subject, pre.body]);
  const toKey = useRef<string | null>(null);
  useEffect(() => {
    if (!peopleQ.isSuccess || !pre.to || toKey.current === pre.to) return;
    toKey.current = pre.to;
    const id = matchDirectoryPersonByToParam(people, pre.to);
    if (id) setSelected(new Set([id]));
    else if (isEmailAddress(pre.to)) setCustomEmails([pre.to.trim().toLowerCase()]);
  }, [peopleQ.isSuccess, people, pre.to]);
  const tplKey = useRef<string | null>(null);
  useEffect(() => {
    const t = pre.template ? templatesQ.data?.find((x) => x.id === pre.template) : undefined;
    if (!t || tplKey.current === t.id) return;
    tplKey.current = t.id;
    applyTemplate(t);
  }, [pre.template, templatesQ.data, applyTemplate]);

  /* ---------- the Client picker follows the Stage filter */
  const stageById = useMemo(() => {
    const m = new Map<string, 'inc' | 'cmp'>();
    for (const e of engagements) {
      const st = stageOf(e, getStateForEngagement(e));
      for (const id of engagementIdAliases(e.id)) m.set(id, st);
    }
    return m;
  }, [engagements, getStateForEngagement]);
  const inScope = useCallback((projectId: string) => scope === 'all' || (stageById.get(projectId) ?? scope) === scope, [scope, stageById]);
  const scopeNote = scope === 'all' ? null : `Client list shows ${scope === 'inc' ? 'incorporating' : 'compliance'} clients · Stage filter`;

  /* ---------- sent in this session (real sends from this page; the tab forgets them) */
  const sentKey = `vcfo-mail-sent:${me?.id ?? ''}`;
  const [sent, setSent] = useState<SentEntry[]>([]);
  useEffect(() => {
    try {
      setSent(parseSent(sessionStorage.getItem(sentKey)));
    } catch {
      /* storage unavailable */
    }
  }, [sentKey]);
  const logSent = (entry: SentEntry) =>
    setSent((list) => {
      const next = pushSent(list, entry);
      try {
        sessionStorage.setItem(sentKey, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  const recipients = useMemo(() => recipientsOf(people, selected, customEmails), [people, selected, customEmails]);
  const to = recipients.map((r) => r.email);
  const dirty = to.length > 0 || Boolean(subject.trim() || body.trim() || applied);

  /* ---------- send (live ComposeMail.send) */
  const send = async () => {
    setErr(null);
    if (to.length === 0) return setErr({ title: 'Pick a recipient', text: 'Choose someone in To, or type an email address.' });
    if (!subject.trim()) return setErr({ title: 'Subject required', text: 'Add a subject before sending.' });
    if (!body.trim()) return setErr({ title: 'Message required', text: 'Write a message before sending.' });
    setSending(true);
    try {
      const res = await fetch('/api/outlook/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject: subject.trim(), text: body, branding: applied?.branding ?? 'plain', templateId: applied?.id }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; from?: string };
      if (!res.ok || json.ok === false) {
        if (res.status === 409 || json.error === 'outlook_not_connected') {
          setErr({ title: 'Connect Outlook', text: 'Link your mailbox in Settings, then send again.' });
          return;
        }
        throw new Error(json.error ?? 'send_failed');
      }
      toast(`Email sent from ${json.from ?? 'your Outlook mailbox'} to ${to.join(', ')}`);
      logSent({ at: new Date().toISOString(), subject: subject.trim(), to, from: json.from });
      setSubject('');
      setBody('');
      setSelected(new Set());
      setCustomEmails([]);
      setApplied(null);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setErr({ title: "Email didn't send", text: SEND_CODES[code] ?? errorMessage(e) });
    } finally {
      setSending(false);
    }
  };

  /* ---------- discard (prototype), with Undo */
  const discard = () => {
    const snap = { selected, customEmails, subject, body, applied };
    setSelected(new Set());
    setCustomEmails([]);
    setSubject('');
    setBody('');
    setApplied(null);
    setErr(null);
    setPickerKey((k) => k + 1);
    toast('Draft discarded', () => {
      setSelected(snap.selected);
      setCustomEmails(snap.customEmails);
      setSubject(snap.subject);
      setBody(snap.body);
      setApplied(snap.applied);
    });
  };

  /* ---------- search palette: templates */
  const templates = templatesQ.data;
  const palette = useMemo<PaletteItem[]>(
    () => (templates ?? []).map((t) => ({ id: `tpl:${t.id}`, label: t.name, kind: 'Email template', sw: 'var(--ice)', go: () => go(`${base}/mail?template=${encodeURIComponent(t.id)}`) })),
    [templates, go, base],
  );
  useConsolePalette('email-templates', palette);

  const statusText = loadingStatus ? 'Checking Outlook…' : connected ? 'Outlook connected' : configured ? 'Outlook not connected' : 'Outlook not configured';
  const fromText = loadingStatus ? 'Checking Outlook…' : connected && msEmail ? msEmail : configured ? 'Outlook not connected' : 'Outlook not configured (Azure app)';

  return (
    <>
      <div className="sec-h">
        <h2>Email</h2>
        <span className="sec-count" title={connected && msEmail ? `Sending from ${msEmail}` : undefined}>
          {statusText}
        </span>
      </div>

      <TemplateGallery appliedId={applied?.id ?? null} onApply={applyTemplate} onClear={clearTemplate} />

      <div className="mx-row11">
        <section className="glass panel mx-compose">
          <div className="ph">
            <div className="mx-pt">
              <h3>New email</h3>
              <span className="small ws-ell" title={fromText}>
                {connected && msEmail ? `Sent through your Outlook mailbox · ${msEmail}` : fromText}
              </span>
            </div>
          </div>
          {!loadingStatus && !configured ? (
            <div className="banner due ws-banner">
              <Icon name="alert" />
              <div>
                <b>Outlook is not set up</b>
                <span>The Outlook (Azure app) connection is not configured for this site, so nothing can be sent from here yet.</span>
              </div>
            </div>
          ) : !loadingStatus && !connected ? (
            <div className="banner info ws-banner">
              <Icon name="mail" />
              <div>
                <b>Connect your Outlook mailbox</b>
                <span>Email here goes out from your own mailbox. Connect Outlook in Settings, then send.</span>
              </div>
              <span className="sp" />
              <Btn cls="sm" ico="gear" onClick={() => go(`${base}/settings`)}>
                Open Settings
              </Btn>
            </div>
          ) : null}

          <RecipientPicker
            key={pickerKey}
            people={people}
            loading={peopleQ.isPending}
            failed={peopleQ.isError}
            onRetry={() => void peopleQ.refetch()}
            selected={selected}
            onToggle={(id) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onApplyAutoFill={(remove, add) => setSelected((prev) => applyAutoFill(prev, remove, add))}
            customEmails={customEmails}
            onAddCustomEmails={(emails) => setCustomEmails((prev) => [...prev, ...emails.filter((e) => !prev.includes(e))])}
            onRemoveCustomEmail={(email) => setCustomEmails((prev) => prev.filter((e) => e !== email))}
            inScope={inScope}
            scopeNote={scopeNote}
          />

          <div className="mx-mrow">
            <label className="mx-fl" htmlFor="ws-subject">
              Subject
            </label>
            <input id="ws-subject" className="mx-in grow" value={subject} maxLength={500} placeholder="Subject" onChange={(e) => setSubject(e.target.value)} />
          </div>
          {applied ? (
            <div className="mx-mrow">
              <span className="mx-fl" aria-hidden="true" />
              <div className="mx-chips">
                <span className="pill up" title={applied.description ?? applied.subject}>
                  <Icon name="notes" />
                  {`Using ${applied.name} · ${emailBrandingLabel(applied.branding)}`}
                  <button type="button" aria-label="Write without a template" title="Write without a template" onClick={clearTemplate}>
                    <Icon name="x" size={11} />
                  </button>
                </span>
              </div>
            </div>
          ) : null}
          <textarea className="mx-in mx-body" rows={12} aria-label="Message" value={body} maxLength={20000} placeholder="Write the email…" onChange={(e) => setBody(e.target.value)} />
          {err ? (
            <p className="ws-err" role="alert">
              <b>{err.title}</b> {err.text}
            </p>
          ) : null}
          <div className="mx-mfoot">
            <Btn onClick={discard} disabled={!dirty || sending}>
              Discard
            </Btn>
            <span className="sp" />
            <Btn cls="pri" ico="send" disabled={sending || !connected} title={!connected && !loadingStatus ? 'Connect Outlook in Settings to send' : undefined} onClick={() => void send()}>
              {sending ? 'Sending…' : 'Send'}
            </Btn>
          </div>
        </section>

        <HowItArrives from={connected && msEmail ? msEmail : 'your Outlook mailbox'} to={to} subject={subject} body={body} template={applied} sent={sent} />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- preview */

function HowItArrives({ from, to, subject, body, template, sent }: { from: string; to: string[]; subject: string; body: string; template: EmailTemplateDto | null; sent: SentEntry[] }) {
  const branding = template?.branding ?? 'plain';
  const sSubject = useSettled(subject);
  const sBody = useSettled(body);
  const html = useMemo(() => {
    const text = sBody.trim();
    if (!text) return '';
    if (branding === 'sbc') return wrapComposeBodyHtml(text, 'sbc', sSubject);
    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:18px 20px;background:#fff">${htmlFromPlainText(text)}</body></html>`;
  }, [sSubject, sBody, branding]);
  const [h, setH] = useState(260);
  const fit = (e: SyntheticEvent<HTMLIFrameElement>) => {
    const next = e.currentTarget.contentDocument?.documentElement?.scrollHeight;
    if (next) setH(Math.min(Math.max(next, 200), 900));
  };
  return (
    <section className="glass panel mx-eprev">
      <div className="ph">
        <div className="mx-pt">
          <h3>How it arrives</h3>
          <span className="small ws-ell" title={`${emailBrandingLabel(branding)} · from ${from}`}>{`${emailBrandingLabel(branding)} · from ${from}`}</span>
        </div>
      </div>
      <div className="mx-mail">
        <div className="mx-mailm">
          <span>
            To <b>{to.join(', ') || '—'}</b>
          </span>
          <span>
            Subject <b>{subject.trim() || '—'}</b>
          </span>
        </div>
        {html ? (
          <iframe className="ws-mailframe" title="How the email arrives" sandbox="allow-same-origin" srcDoc={html} onLoad={fit} style={{ height: h }} />
        ) : (
          <div className="mx-mailb">Your message appears here as you type.</div>
        )}
      </div>
      <div className="mx-sub-h">
        <span className="eyebrow">Sent from here this session</span>
        {sent.length ? <span className="small">{sent.length === 1 ? '1 email' : `${sent.length} emails`}</span> : null}
      </div>
      {sent.length ? (
        sent.map((s) => (
          <div key={s.at} className="mx-sentr">
            <Icon name="send" />
            <span className="mx-dt">
              <b className="ws-ell" title={s.subject}>
                {s.subject}
              </b>
              <span className="ws-ell" title={s.to.join(', ')}>{`To ${s.to.join(', ')} · ${timeLabel(s.at)}`}</span>
            </span>
          </div>
        ))
      ) : (
        <p className="small">Emails you send from this page are listed here until you close the tab.</p>
      )}
    </section>
  );
}
