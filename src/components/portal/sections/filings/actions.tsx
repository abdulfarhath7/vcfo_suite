'use client';

/**
 * CONTRACT (used by Home, Calendar, Filings and Search — keep the signatures):
 *   useFilingActions() → {
 *     openFiling(f, anchor?, opts?)  the small filing card popover (prototype filingCard / openFiling);
 *                                    opts.push keeps the current card under a Back button;
 *     openFilingWizard(f)            the filing's step-by-step walkthrough (prototype openWizardFor);
 *     openDay(iso, anchor?, opts?)   the day card listing that day's filings (prototype openDay);
 *                                    opts.tasks also lists the non-statutory tasks ending that day (C-3);
 *   }
 *
 * Every card is a component that reads the live register (useFilings), so an
 * open card updates after "Remind me" or a window change. The steps come from
 * the real focus-track dates SBC records (src/lib/client-portal/filing-track.ts).
 * Real actions: Remind me (POST/DELETE /api/client/compliances/:id/reminder),
 * Add to my calendar (/:id/ics), the working window (/:id/window), proof files
 * (/:id/proofs, /:id/proofs/:proofId), Ask VCFO, the authority's portal.
 */
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fyStartOfMonth, portalFor, statusOf, type PortalFiling } from '@/lib/client-portal/compliances';
import { byStatus, filingTrack, filingWhat, penaltyLine, whoActs, worstOf, type FilingTrackStep } from '@/lib/client-portal/filing-track';
import { usePortal } from '../../runtime';
import { getJson, PK, QK, sendJson, useFilings } from '../../data';
import { addDays, daysTo, fmt, fmtL, fmtY, MON, P, rel, todayIso } from '../../dates';
import { PopHead, WizardView, type WizStep } from '../../overlays';
import { Btn, GoArrow, Icon, IconBtn, LAW_BY, LawChip, ST_LABEL, StatusPill } from '../../ui';
import { useDocActions } from '../documents/actions';
import { StatExtrasBlock } from './StatExtras';
import { taskAsRow, taskHint } from '@/components/client-portal/pages/compliances/tasks';
import { useClientTasks } from '@/components/client-portal/pages/compliances/task-api';
import { TaskTag, TaskWordPill, useOpenTask } from './task-bits';
import { rowWords, taskTitle } from './tasks-model';

export interface FilingActions {
  openFiling: (f: PortalFiling, anchor?: Element | null, opts?: { push?: boolean }) => void;
  openFilingWizard: (f: PortalFiling) => void;
  openDay: (iso: string, anchor?: Element | null, opts?: { tasks?: boolean }) => void;
}

export function useFilingActions(): FilingActions {
  const { openPop, openWizard } = usePortal();
  const openFiling = useCallback(
    (f: PortalFiling, anchor?: Element | null, opts?: { push?: boolean }) => openPop(anchor ?? null, <FilingCard f={f} />, { push: opts?.push, kind: 'filing' }),
    [openPop],
  );
  // a line from SBC's compliance calendar has no steps yet: its card says what it is instead
  const openFilingWizard = useCallback(
    (f: PortalFiling) => (f.fromCalendar ? openPop(null, <FilingCard f={f} />, { kind: 'filing' }) : openWizard(<FilingWizard f={f} />)),
    [openPop, openWizard],
  );
  const openDay = useCallback(
    (iso: string, anchor?: Element | null, opts?: { tasks?: boolean }) => openPop(anchor ?? null, <DayCard iso={iso} tasks={opts?.tasks} />, { kind: 'day' }),
    [openPop],
  );
  return useMemo(() => ({ openFiling, openFilingWizard, openDay }), [openFiling, openFilingWizard, openDay]);
}

/* ---------------------------------------------------------------- live data */

/** The register of one financial year (the FY that holds `iso`). */
export function useFyFilings(iso: string) {
  const fy = fyStartOfMonth(iso.slice(0, 7));
  return useFilings(fy);
}
/** The live copy of a filing from the whole register (no `fy`: every year), else the row the card was opened with. */
function useLiveFiling(f: PortalFiling): PortalFiling {
  const q = useFilings();
  return q.data?.rows.find((r) => r.id === f.id) ?? f;
}

/** Refetch every filings list (and Home, which shows this FY's filings). */
export function useRefreshFilings(): () => void {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: [PK, 'filings'] });
    void qc.invalidateQueries({ queryKey: QK.home });
  }, [qc]);
}

/** Start a same-origin download (CSV, .ics, proof). */
export function download(href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function useCompanyShort(): string {
  const { shell } = usePortal();
  return shell?.companyShort || 'Your company';
}

/** "Remind me" toggle: sets the caller's own email reminder (due − 3 days) or removes it. */
export function useReminder(f: PortalFiling) {
  const { toast } = usePortal();
  const refresh = useRefreshFilings();
  const [busy, setBusy] = useState(false);
  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (f.reminderOn) {
        await sendJson(`/api/client/compliances/${f.id}/reminder`, 'DELETE');
        toast(`Reminder removed · ${f.name}`);
      } else {
        const r = await sendJson<{ remindOn?: string }>(`/api/client/compliances/${f.id}/reminder`, 'POST', { channels: ['email'] });
        toast(`Reminder set · ${f.name}${r.remindOn ? ` · email on ${fmt(r.remindOn)}` : ''}`);
      }
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the reminder');
    } finally {
      setBusy(false);
    }
  }, [busy, f.id, f.name, f.reminderOn, refresh, toast]);
  return { toggle, busy };
}

const portalHost = (url: string): string => url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]!;

/* ---------------------------------------------------------------- filing card */

const MINI: Record<FilingTrackStep['state'], string> = { done: 'd', now: 'n', stuck: 'r', up: '' };

export function FilingCard({ f: f0 }: { f: PortalFiling }) {
  if (f0.fromCalendar) return <CalendarLineCard f={f0} />;
  return <RegisterFilingCard f={f0} />;
}

/**
 * A deadline from SBC's statutory compliance calendar, shown while the company
 * has no filings on its register (src/lib/client-portal/statutory-fallback.ts).
 * Informational: what, when, how often, and that it applies once the company is
 * set up. No reminder, proof, working window or walkthrough — those belong to
 * register filings.
 */
function CalendarLineCard({ f }: { f: PortalFiling }) {
  const { closePop, openChat } = usePortal();
  const co = useCompanyShort();
  const today = todayIso();
  const dd = daysTo(f.dueDate, today);
  const [, url] = portalFor(f);
  return (
    <div>
      <div className="pop-h">
        <div className="fc-chips">
          <LawChip law={f.area} />
          <span className="pill mut">SBC calendar</span>
        </div>
        <button type="button" className="ib x" aria-label="Close" onClick={() => closePop()}>
          <Icon name="x" />
        </button>
      </div>
      <div className="fc-t">{f.name}</div>
      <div className="small" style={{ marginTop: 2 }}>
        {f.period} · {f.authorityName}
      </div>
      {f.particular !== f.name ? (
        <div className="small" style={{ marginTop: 6 }}>
          On this line of the calendar: {f.particular}
        </div>
      ) : null}
      <div className="fc-grid">
        <div>
          <span>DUE</span>
          <b>{fmtL(f.dueDate)}</b>
        </div>
        <div>
          <span>WHEN</span>
          <b>{dd === 0 ? 'Today' : rel(dd)}</b>
        </div>
        <div>
          <span>HOW OFTEN</span>
          <b>{f.freqLabel}</b>
        </div>
        <div>
          <span>APPLIES</span>
          <b>Once incorporated</b>
        </div>
      </div>
      <div className="fc-now">
        <span>
          <b>From SBC’s compliance calendar for {f.fyLabel ?? 'this year'}. </b>
          {co} has no filings on its register yet. This deadline applies once {co} is incorporated and registered; SBC then adds it to your register and files it.
        </span>
      </div>
      <div className="fc-acts">
        <Btn ico="chat" onClick={() => openChat(`What is ${f.name}, and when will it apply to us?`)}>
          Ask
        </Btn>
        <span className="sp" />
        <GoArrow label={portalHost(url)} href={url} />
      </div>
    </div>
  );
}

function RegisterFilingCard({ f: f0 }: { f: PortalFiling }) {
  const f = useLiveFiling(f0);
  const { closePop, openChat, openPop, toast } = usePortal();
  const { openFilingWizard } = useFilingActions();
  const co = useCompanyShort();
  const today = todayIso();
  const st = statusOf(f, today);
  const steps = filingTrack(f, co, today);
  const dd = daysTo(f.dueDate, today);
  const nowI = steps.findIndex((s) => s.state === 'now' || s.state === 'stuck');
  const pen = penaltyLine(f, today);
  const reminder = useReminder(f);
  const [, url] = portalFor(f);
  const youWait = nowI >= 0 && steps[nowI]!.who === 'YOU';
  const filed = st === 'ok';
  return (
    <div>
      <div className="pop-h">
        <div className="fc-chips">
          <LawChip law={f.area} />
          <StatusPill st={st} />
        </div>
        <button type="button" className="ib x" aria-label="Close" onClick={() => closePop()}>
          <Icon name="x" />
        </button>
      </div>
      <div className="fc-t">{f.name}</div>
      <div className="small" style={{ marginTop: 2 }}>
        {f.period} · {f.authorityName}
      </div>
      <div className="fc-grid">
        <div>
          <span>DUE</span>
          <b>{fmtL(f.dueDate)}</b>
        </div>
        <div>
          <span>{filed ? 'FILED ON' : 'WHEN'}</span>
          <b style={st === 'over' ? { color: 'var(--over-ink)' } : undefined}>{filed ? fmtY(f.filedOn!) : st === 'over' ? `${-dd} day${dd === -1 ? '' : 's'} late` : rel(dd)}</b>
        </div>
        <div>
          <span>{filed ? 'FILED BY' : 'WHO ACTS'}</span>
          <b>{whoActs(f, steps)}</b>
        </div>
        <div>
          <span>HOW OFTEN</span>
          <b>{f.freqLabel}</b>
        </div>
        {filed && f.acknowledgementNo ? (
          <div>
            <span>REFERENCE</span>
            <b className="mono" style={{ overflowWrap: 'anywhere' }}>
              {f.acknowledgementNo}
            </b>
          </div>
        ) : null}
        {filed && f.amountPaid ? (
          <div>
            <span>TAX PAID</span>
            <b>{inr(f.amountPaid)}</b>
          </div>
        ) : null}
      </div>
      <div className="mini-steps" aria-label={`${steps.filter((s) => s.state === 'done').length} of ${steps.length} steps done`}>
        {steps.map((s) => (
          <i key={s.key} className={MINI[s.state]} />
        ))}
      </div>
      <div className="fc-now">
        {filed ? (
          <span>
            <b>All steps done. </b>
            {f.proofCount ? `${f.proofCount} proof file${f.proofCount === 1 ? '' : 's'} saved.` : 'SBC will upload the acknowledgement as proof.'}
          </span>
        ) : nowI >= 0 ? (
          <span>
            <b>
              Step {nowI + 1} of {steps.length}:{' '}
            </b>
            {steps[nowI]!.title}
          </span>
        ) : (
          <span>
            <b>{steps.length} steps. </b>
            Work starts closer to the due date.
          </span>
        )}
      </div>
      {!filed ? (
        <div className="fc-now">
          {f.windowFrom && f.windowTo ? (
            <span>
              Your working window: <b>{fmt(f.windowFrom)} – {fmt(f.windowTo)}</b>.{' '}
            </span>
          ) : null}
          <button type="button" style={{ color: 'var(--ice)', fontWeight: 600, padding: 0 }} onClick={() => openPop(null, <WindowCard f={f} />, { push: true })}>
            {f.windowFrom ? 'Change it' : 'Plan when you work on it'}
          </button>
        </div>
      ) : null}
      <StatExtrasBlock f={f} />
      {pen ? (
        <div className="fc-pen">
          <Icon name="alert" />
          <span>{pen}</span>
        </div>
      ) : null}
      <div className="fc-acts">
        <Btn
          cls="pri"
          ico="step"
          onClick={() => {
            closePop();
            openFilingWizard(f);
          }}
        >
          {youWait ? 'Do my part, step by step' : 'Step by step'}
        </Btn>
        {filed ? (
          <Btn ico="doc" onClick={() => openPop(null, <ProofCard f={f} />, { push: true })}>
            Proof
          </Btn>
        ) : (
          <Btn ico="bell" onClick={() => void reminder.toggle()} disabled={reminder.busy} title={f.reminderOn ? 'Remove the reminder' : 'Email me 3 days before'}>
            {f.reminderOn ? `Reminder ${fmt(f.reminderOn)}` : 'Remind me'}
          </Btn>
        )}
        <Btn ico="chat" onClick={() => openChat(`How does ${f.name} work?`)}>
          Ask
        </Btn>
        {!filed ? (
          <IconBtn
            ico="cal"
            label="Add to my calendar"
            onClick={() => {
              download(`/api/client/compliances/${f.id}/ics`);
              toast(`Download started · ${f.name} · ${f.period}.ics`);
            }}
          />
        ) : null}
        <span className="sp" />
        <GoArrow label={portalHost(url)} href={url} />
      </div>
    </div>
  );
}

function inr(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/* ---------------------------------------------------------------- day card */

export function DayCard({ iso, tasks }: { iso: string; tasks?: boolean }) {
  const q = useFilings();
  // C-3: the tasks that end this day, only when the calendar shows tasks (never under Statutory or an area pick)
  const tq = useClientTasks(Boolean(tasks));
  const openTask = useOpenTask();
  const { openPop } = usePortal();
  const today = todayIso();
  const list = byStatus((q.data?.rows ?? []).filter((r) => r.dueDate.slice(0, 10) === iso), today);
  const dayTasks = tasks ? (tq.data ?? []).filter((t) => t.endDate === iso).map(taskAsRow) : [];
  const d = P(iso);
  const n = daysTo(iso, today);
  const worst = list.length || dayTasks.length ? worstOf([...list, ...dayTasks], today) : null;
  const co = useCompanyShort();
  return (
    <div>
      <PopHead
        title={fmtL(iso)}
        sub={list.length || dayTasks.length ? `${rowWords([...list, ...dayTasks])} · ${rel(n)}` : q.isPending ? 'Loading…' : 'Nothing due'}
        lead={
          <div className={'dtile' + (worst ? ' s-' + worst : '')}>
            <b>{d.getUTCDate()}</b>
            <span>{MON[d.getUTCMonth()]!.toUpperCase()}</span>
          </div>
        }
      />
      {list.length ? (
        list.map((r) => {
          const st = statusOf(r, today);
          const steps = filingTrack(r, co, today);
          const you = st !== 'ok' && steps.find((s) => s.state !== 'done')?.who === 'YOU';
          return (
            <button key={r.id} type="button" className="pi" onClick={() => openPop(null, <FilingCard f={r} />, { push: true })}>
              <LawChip law={r.area} />
              <div style={{ minWidth: 0 }}>
                <b>{r.name}</b>
                <div className="s">
                  {r.fromCalendar
                    ? `SBC calendar · ${r.freqLabel} · applies once incorporated`
                    : `${ST_LABEL[st]} · ${r.freqLabel} · ${st === 'ok' ? 'filed' : you ? 'needs you first' : 'SBC files'}`}
                </div>
              </div>
              <Icon name="chev" size={16} />
            </button>
          );
        })
      ) : q.isPending || dayTasks.length ? null : (
        <p className="small" style={{ marginTop: 12 }}>
          Nothing due on this date.
        </p>
      )}
      {dayTasks.map((r) => (
        <button key={r.id} type="button" className="pi" title={taskTitle(r, today)} onClick={() => openTask(r)}>
          <TaskTag task={r.task} />
          <div style={{ minWidth: 0 }}>
            <b>{r.name}</b>
            <div className="s" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <TaskWordPill task={r.task} today={today} tiny />
              {taskHint(r.task)}
            </div>
          </div>
          <Icon name="chev" size={16} />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- proof card */

interface ProofMeta {
  id: string;
  fileName: string;
  mime: string | null;
  sizeBytes: number | null;
  kind: string;
  isPrimary: boolean;
  uploadedAt: string;
  uploadedBy: string | null;
}

function useProofs(f: PortalFiling) {
  return useQuery({
    queryKey: [PK, 'filing-proofs', f.id, f.proofCount],
    enabled: Boolean(f.filedOn),
    queryFn: async () => (await getJson<{ proofs: ProofMeta[] }>(`/api/client/compliances/${f.id}/proofs`))?.proofs ?? [],
    staleTime: 60_000,
  });
}
const proofHref = (fid: string, pid: string) => `/api/client/compliances/${fid}/proofs/${encodeURIComponent(pid)}`;
const KIND: Record<string, string> = { acknowledgement: 'Acknowledgement', challan: 'Challan', certificate: 'Certificate', other: 'File' };
function kb(n: number | null): string {
  if (n == null) return '';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** The proof files of a filed filing, each opening the stored file. */
function ProofList({ f }: { f: PortalFiling }) {
  const q = useProofs(f);
  if (q.isPending) return <p className="small" style={{ marginTop: 12 }}>Loading the proof…</p>;
  if (q.isError) return <p className="small" style={{ marginTop: 12, color: 'var(--over-ink)' }}>Could not load the proof files.</p>;
  const list = q.data ?? [];
  if (!list.length)
    return (
      <p className="small" style={{ marginTop: 12 }}>
        SBC will upload the challan or acknowledgement here.
      </p>
    );
  return (
    <>
      {list.map((p) => (
        <a key={p.id} className="pi" href={proofHref(f.id, p.id)} target="_blank" rel="noopener noreferrer">
          <Icon name="doc" size={18} />
          <div style={{ minWidth: 0 }}>
            <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.fileName}</b>
            <div className="s">{[KIND[p.kind] ?? 'File', kb(p.sizeBytes), fmt(todayIso(new Date(p.uploadedAt).getTime()))].filter(Boolean).join(' · ')}</div>
          </div>
          <Icon name="dl" size={16} />
        </a>
      ))}
    </>
  );
}

export function ProofCard({ f: f0 }: { f: PortalFiling }) {
  const f = useLiveFiling(f0);
  const { toast } = usePortal();
  const [portal, url] = portalFor(f);
  const late = f.filedOn ? daysTo(f.filedOn, f.dueDate) : 0;
  const copy = (t: string) => {
    void navigator.clipboard?.writeText(t).then(
      () => toast('Reference copied'),
      () => toast('Select the reference to copy it'),
    );
  };
  return (
    <div>
      <PopHead title="Proof of filing" sub={`${f.name} · ${f.period}`} lead={<LawChip law={f.area} />} />
      <div className="fc-grid">
        <div>
          <span>REFERENCE</span>
          <b className="mono" style={{ overflowWrap: 'anywhere' }}>
            {f.acknowledgementNo ?? '—'}
          </b>
        </div>
        <div>
          <span>FILED ON</span>
          <b>{f.filedOn ? fmtY(f.filedOn) : '—'}</b>
        </div>
        <div>
          <span>FILED BY</span>
          <b>{f.filedByName ? `${f.filedByName} · SBC` : 'SBC'}</b>
        </div>
        <div>
          <span>DUE WAS</span>
          <b>{fmtY(f.dueDate)}</b>
        </div>
      </div>
      {f.filedOn ? (
        <div className={'banner ' + (late > 0 ? 'over' : 'ok')} style={{ marginTop: 12 }}>
          <Icon name={late > 0 ? 'alert' : 'check'} />
          <div>
            <b>{late > 0 ? `Filed ${late} day${late === 1 ? '' : 's'} after the due date` : late < 0 ? `Filed ${-late} day${late === -1 ? '' : 's'} early` : 'Filed on the due date'}</b>
            <span>{f.proofCount ? 'The proof is below.' : 'The acknowledgement will be saved here.'}</span>
          </div>
        </div>
      ) : null}
      <ProofList f={f} />
      <div className="fc-acts">
        {f.acknowledgementNo ? (
          <Btn cls="pri" ico="copy" onClick={() => copy(f.acknowledgementNo!)}>
            Copy reference
          </Btn>
        ) : null}
        <span className="sp" />
        <GoArrow label={`Verify on the ${portal}`} href={url} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- working window */

const PREP: Record<string, number> = { monthly: 5, quarterly: 10, 'half-yearly': 10, annual: 21 };

/** The client plans their own working window for a filing (the due date never moves). */
function WindowCard({ f: f0 }: { f: PortalFiling }) {
  const f = useLiveFiling(f0);
  const { toast, popBack } = usePortal();
  const refresh = useRefreshFilings();
  const [from, setFrom] = useState(f.windowFrom ?? addDays(f.dueDate, -(PREP[f.frequency.toLowerCase()] ?? 5)));
  const [to, setTo] = useState(f.windowTo ?? f.dueDate);
  const [busy, setBusy] = useState(false);
  const bad = !from || !to || from > to;
  const save = async (clear: boolean) => {
    setBusy(true);
    try {
      await sendJson(`/api/client/compliances/${f.id}/window`, 'POST', clear ? { from: null, to: null } : { from, to });
      toast(clear ? `${f.name} window cleared` : `${f.name} window · ${fmt(from)} – ${fmt(to)}${to > f.dueDate ? ' · ends after the due date' : ''}`);
      refresh();
      popBack();
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      toast(m === 'filed_locked' ? 'This filing is filed; its window is locked.' : m === 'clear_not_permitted' ? 'SBC set this window; only SBC can clear it.' : 'Could not save the window.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PopHead title="Your working window" sub={`${f.name} · due ${fmtY(f.dueDate)}`} lead={<LawChip law={f.area} />} />
      <p className="small" style={{ marginTop: 10 }}>
        Plan the days you will gather the data. SBC sees it; the due date stays the same.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
        <label className="mf">
          <span className="mf-l">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="mf">
          <span className="mf-l">To</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {!bad && to > f.dueDate ? (
        <div className="fc-pen">
          <Icon name="alert" />
          <span>This window ends after the due date.</span>
        </div>
      ) : null}
      <div className="fc-acts">
        <Btn cls="pri" ico="check" disabled={bad || busy} onClick={() => void save(false)}>
          Save window
        </Btn>
        {f.windowFrom ? (
          <Btn disabled={busy} onClick={() => void save(true)}>
            Clear
          </Btn>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- walkthrough */

export function FilingWizard({ f: f0 }: { f: PortalFiling }) {
  const f = useLiveFiling(f0);
  const co = useCompanyShort();
  const { closeWizard } = usePortal();
  const { focusUpload } = useDocActions();
  const proofs = useProofs(f);
  const today = todayIso();
  const st = statusOf(f, today);
  const track = filingTrack(f, co, today);
  const steps: WizStep[] = track.map((s) => ({
    who: s.who,
    title: s.title,
    body: s.body,
    sub: s.sub,
    state: s.state,
    extra:
      s.key === 'data' && (s.state === 'now' || s.state === 'stuck') ? (
        <div style={{ marginTop: 14 }}>
          <Btn
            ico="up"
            onClick={() => {
              closeWizard();
              focusUpload();
            }}
          >
            Send it in Documents
          </Btn>
        </div>
      ) : s.key === 'file' && f.filedOn ? (
        <ProofList f={f} />
      ) : undefined,
  }));
  return (
    <WizardView
      title={f.name}
      sub={`${LAW_BY[f.area].name} · ${f.period} · due ${fmtL(f.dueDate)} · ${ST_LABEL[st]}`}
      steps={steps}
      what={filingWhat(f)}
      docs={(proofs.data ?? []).map((p) => p.fileName)}
      pen={penaltyLine(f, today) ?? undefined}
      ask={`How does ${f.name} work?`}
    />
  );
}
