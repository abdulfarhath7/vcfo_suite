'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, CircleAlert, Info, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { StepMark } from '@/components/ui/step-track';
import { Chip } from '@/components/ui/spectrum-chip';
import { SkeletonRows } from '@/components/ui/empty-state';
import { OtpBox } from '@/components/gstzen/OtpBox';
import { GstNoticesSection } from '@/components/gstzen/GstNoticesSection';
import {
  useConsentOtp,
  useGstReturnAction,
  useGstReturnForPeriod,
  useGstReturnRun,
  useGstzenStatus,
  useStartGstReturn,
  type GstRunActionBody,
  type GstRunBundle,
} from '@/hooks/use-gstzen';
import { checkLabels, formatInr, nextStep, runSteps, type GstCheckKey, type RunFacts } from '@/lib/gstzen/run-state';
import {
  GST_FORM_LABEL,
  PAN_RE,
  TASK_FORM,
  defaultRetPeriod,
  isAnnualForm,
  isRetPeriod,
  periodLabelOf,
  type GstForm,
  type GstReturnSummary,
} from '@/lib/gstzen/types';
import { cn } from '@/lib/utils';
import type { CardAgentBodyProps } from './types';

/**
 * The body of an API-route card agent: a GST return filed through the GSP API (GSTZen), MASTER-PLAN
 * screen 7. From top to bottom: the steps strip, the one next step (a "Your turn" card when a person
 * must act: the consent OTP, paying any cash due from their own bank, the EVC OTP), the portal's own
 * figures with the GSTR-2B line, the certifier's two checks, the ARN at the end, and the engagement's
 * GST notices (`GstNoticesSection`).
 *
 * The person gives every OTP and pays; the agent never signs or pays. Signing with a DSC needs the
 * signer's own token and is shown as a step that is not built yet, with EVC offered instead. Slow
 * work (save, offset, proceed to file) runs as a job and the card polls while it runs.
 */
export function ApiFileBody({ engagementId, instanceId, task }: CardAgentBodyProps) {
  const form: GstForm = TASK_FORM[task.taskId] ?? 'gstr3b';
  const [chosen, setChosen] = useState<string | null>(instanceId ? null : defaultRetPeriod(form, todayIst()));
  const status = useGstzenStatus(engagementId);
  const latest = useGstReturnForPeriod(engagementId, form, chosen, instanceId);
  const period = chosen ?? latest.data?.period ?? null;
  const runId = latest.data?.run?.id ?? null;
  const bundleQ = useGstReturnRun(runId);
  const start = useStartGstReturn();
  const open = status.data?.open ?? false;
  const gstin = status.data?.gstin ?? null;

  return (
    <div className="grid gap-4 text-[13.5px] text-ink">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-semibold">{GST_FORM_LABEL[form]}</span>
        <PeriodPicker form={form} value={period} onChange={setChosen} locked={Boolean(instanceId && !chosen && latest.data?.period)} />
        {gstin ? <span className="font-mono text-[12.5px] text-ink-muted">GSTIN {gstin}</span> : null}
        <span className="ml-auto">
          <Chip raw tone={open ? 'ok' : 'idle'}>{open ? 'GSTZen on' : 'GSTZen off'}</Chip>
        </span>
      </header>

      {status.isLoading || latest.isLoading ? <SkeletonRows rows={4} /> : null}
      {status.isError ? <Notice tone="danger">{errText(status.error)}</Notice> : null}
      {status.data && !open ? <Notice tone="info">{status.data.message ?? 'The GSTZen route is closed.'} The card shows what is already saved; nothing is sent to the portal.</Notice> : null}
      {status.data && !gstin ? <Notice tone="warning">Record the GSTIN on the GST registration first. The agent files against that GSTIN only.</Notice> : null}

      {bundleQ.data && gstin && bundleQ.data.run.gstin !== gstin && bundleQ.data.run.status !== 'filed' && bundleQ.data.run.status !== 'cancelled' ? (
        <Notice tone="warning">
          This run was started on GSTIN {bundleQ.data.run.gstin}, but the GST registration now shows {gstin}. Cancel this run and start again to file on the recorded GSTIN.
        </Notice>
      ) : null}
      {bundleQ.data ? (
        <RunPanel bundle={bundleQ.data} open={open} />
      ) : !latest.isLoading && status.data && gstin && period ? (
        <YourTurn title="Start" tone="next">
          <p className="text-ink-2">The agent reads the portal’s own figures for {periodLabelOf(form, period)} and saves the return there. You check them before anything is filed.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!open || start.isPending || !isRetPeriod(period)} onClick={() => start.mutate({ engagementId, form, period })}>
              {start.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Start {GST_FORM_LABEL[form]}
            </Button>
            {start.isError ? <ErrorLine>{errText(start.error)}</ErrorLine> : null}
          </div>
        </YourTurn>
      ) : null}

      <GstNoticesSection engagementId={engagementId} className="border-t border-line-soft pt-3" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the run                                                             */
/* ------------------------------------------------------------------ */

function RunPanel({ bundle, open }: { bundle: GstRunBundle; open: boolean }) {
  const { run, session, otp } = bundle;
  const act = useGstReturnAction(run.id);
  const facts: RunFacts = {
    form: run.form,
    status: run.status,
    summary: run.summary,
    flow: run.flow,
    sessionActive: session?.status === 'active',
    pendingOtp: otp.find((o) => o.purpose === 'evc') ? 'evc' : otp.find((o) => o.purpose === 'gstn_consent') ? 'gstn_consent' : null,
  };
  const steps = runSteps(facts);
  const next = nextStep(facts);
  const labels = checkLabels(run.form, run.summary);
  const canCheck = run.status === 'saved' || run.status === 'checked';
  const doAct = (body: GstRunActionBody) => act.mutate(body);

  return (
    <div className="grid gap-4">
      <StepsStrip steps={steps} />

      <NextStepCard bundle={bundle} next={next} open={open} onAct={doAct} acting={act.isPending} />
      {act.isError ? <ErrorLine>{errText(act.error)}</ErrorLine> : null}
      {run.error && run.status !== 'failed' ? <Notice tone="warning">{run.error}</Notice> : null}

      {run.summary ? <Figures summary={run.summary} /> : null}

      {run.summary && run.status !== 'filed' && run.status !== 'cancelled' ? (
        <section aria-label="Certifier checks" className="grid gap-2 rounded-md border border-line bg-surface-raised p-3">
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Certifier checks</h4>
          {(['figures', 'unmatched'] as GstCheckKey[]).map((k) => {
            const c = run.checks[k];
            return (
              <label key={k} className={cn('flex items-start gap-2.5', !canCheck && 'opacity-60')}>
                <Checkbox
                  checked={Boolean(c)}
                  disabled={!canCheck || act.isPending}
                  onCheckedChange={(v) => doAct({ action: 'check', which: k, checked: v === true })}
                  className="mt-0.5"
                  aria-label={labels[k]}
                />
                <span>
                  {labels[k]}
                  {c ? <span className="block text-[12px] text-ink-muted">Ticked by {c.byName ?? 'staff'} on {fmtTime(c.at)}</span> : null}
                </span>
              </label>
            );
          })}
        </section>
      ) : null}

      {run.status === 'filed' && run.arn ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-positive/30 bg-positive-soft px-3 py-2.5">
          <ShieldCheck className="h-4 w-4 text-positive" aria-hidden />
          <span className="font-medium">Filed</span>
          <span className="font-mono">ARN {run.arn}</span>
          {run.filedAt ? <span className="text-ink-muted">{fmtTime(run.filedAt)}</span> : null}
        </div>
      ) : null}

      {run.status !== 'filed' && run.status !== 'cancelled' ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-[12.5px] text-ink-muted">
          {(run.status === 'saved' || run.status === 'checked') && open ? (
            <Button size="sm" variant="quiet" disabled={act.isPending} onClick={() => doAct({ action: 'save' })}>
              Read the figures again
            </Button>
          ) : null}
          <Button size="sm" variant="quiet" disabled={act.isPending} onClick={() => doAct({ action: 'cancel' })}>
            Cancel this run
          </Button>
          <span className="ml-auto">Updated {fmtTime(run.updatedAt)}</span>
        </div>
      ) : null}
    </div>
  );
}

function StepsStrip({ steps }: { steps: ReturnType<typeof runSteps> }) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5" aria-current={s.state === 'current' ? 'step' : undefined}>
          {i > 0 ? <span aria-hidden className={cn('mx-1 h-[1.5px] w-4', steps[i - 1].state === 'done' ? 'bg-positive-mid' : 'bg-line')} /> : null}
          <StepMark size={18} state={s.state === 'done' ? 'done' : s.state === 'upcoming' ? 'next' : 'now'} tone={s.state === 'attention' ? 'bad' : 'prog'} label={`${s.label}: ${s.state}`} />
          <span className={cn('text-[12.5px]', s.state === 'current' || s.state === 'attention' ? 'font-semibold text-ink' : 'text-ink-muted')}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function NextStepCard({ bundle, next, open, onAct, acting }: { bundle: GstRunBundle; next: ReturnType<typeof nextStep>; open: boolean; onAct: (b: GstRunActionBody) => void; acting: boolean }) {
  const { run, otp } = bundle;
  const yours = ['consent', 'consent_wait', 'pay', 'evc', 'evc_wait'].includes(next.kind);
  const title = yours ? 'Your turn' : next.kind === 'working' ? 'Working' : next.kind === 'retry' ? 'Failed' : next.kind === 'done' ? 'Done' : 'Next';
  const tone = yours ? 'yours' : next.kind === 'retry' ? 'bad' : next.kind === 'done' ? 'ok' : 'next';
  const consentReq = otp.find((o) => o.purpose === 'gstn_consent');
  const evcReq = otp.find((o) => o.purpose === 'evc');

  let body: ReactNode;
  switch (next.kind) {
    case 'working':
      body = (
        <p className="flex items-center gap-2 text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {next.text}
        </p>
      );
      break;
    case 'consent':
      body = <ConsentAsk engagementId={run.engagementId} runId={run.id} text={next.text} disabled={!open} />;
      break;
    case 'consent_wait':
      body = consentReq ? (
        <>
          <p className="text-ink-2">{consentReq.audience === 'client' ? 'The client types it in the client portal. If they read it to you on a call, type it here.' : next.text}</p>
          <OtpBox who="staff" request={consentReq} />
        </>
      ) : null;
      break;
    case 'pay':
      body = (
        <>
          <p className="text-ink-2">{next.text}</p>
          <p className="text-[12.5px] text-ink-muted">
            Cash needed Rs {formatInr(run.summary?.cashNeeded ?? 0)}, in the cash ledger Rs {formatInr(run.summary?.cashBalance ?? 0)}. Create the challan (PMT-06) on the GST portal and pay it from your own bank; the agent never pays.
          </p>
          <div>
            <Button size="sm" disabled={!open || acting} onClick={() => onAct({ action: 'refresh_balance' })}>
              I have paid: read the balance again
            </Button>
          </div>
        </>
      );
      break;
    case 'offset':
      body = (
        <>
          <p className="text-ink-2">{next.text}</p>
          <div>
            <Button size="sm" disabled={!open || acting} onClick={() => onAct({ action: 'offset' })}>
              Set off the liability
            </Button>
          </div>
        </>
      );
      break;
    case 'proceed':
      body = (
        <>
          <p className="text-ink-2">{next.text}</p>
          <div>
            <Button size="sm" disabled={!open || acting} onClick={() => onAct({ action: 'proceed' })}>
              Proceed to file
            </Button>
          </div>
        </>
      );
      break;
    case 'evc':
      body = <EvcAsk run={run} text={next.text} disabled={!open || acting} onAct={onAct} />;
      break;
    case 'evc_wait':
      body = evcReq ? (
        <>
          <p className="text-ink-2">{evcReq.audience === 'client' ? 'The signatory types it in the client portal. If they read it to you on a call, type it here.' : next.text}</p>
          <OtpBox who="staff" request={evcReq} />
        </>
      ) : null;
      break;
    case 'retry':
      body = (
        <>
          <p className="text-ink-2">{run.error ?? next.text}</p>
          <div>
            <Button size="sm" disabled={!open || acting} onClick={() => onAct({ action: 'retry' })}>
              Try again
            </Button>
          </div>
        </>
      );
      break;
    case 'start':
      body = (
        <>
          <p className="text-ink-2">{next.text}</p>
          <div>
            <Button size="sm" disabled={!open || acting} onClick={() => onAct({ action: 'save' })}>
              Read and save
            </Button>
          </div>
        </>
      );
      break;
    case 'not_ready':
      body = (
        <>
          <p className="text-ink-2">{next.text}</p>
          <div>
            <Button size="sm" variant="secondary" disabled={!open || acting} onClick={() => onAct({ action: 'save' })}>
              Read the figures again
            </Button>
          </div>
        </>
      );
      break;
    default:
      body = <p className="text-ink-2">{next.text}</p>;
  }
  return (
    <YourTurn title={title} tone={tone}>
      {body}
    </YourTurn>
  );
}

function ConsentAsk({ engagementId, runId, text, disabled }: { engagementId: string; runId: string; text: string; disabled: boolean }) {
  const consent = useConsentOtp();
  const [audience, setAudience] = useState<'client' | 'staff'>('client');
  const [needsUsername, setNeedsUsername] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const ask = () =>
    consent.mutate(
      { engagementId, audience, runId, username: needsUsername ? username.trim() || null : null },
      {
        onSuccess: (r) => {
          if (r.needsUsername) setNeedsUsername(r.message ?? 'Type the client’s GST portal username.');
          else {
            setNeedsUsername(null);
            setUsername('');
          }
        },
      },
    );
  return (
    <div className="grid gap-2.5">
      <p className="text-ink-2">{text} The GST portal sends it to the taxpayer’s registered mobile.</p>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5">
        <legend className="sr-only">Who types the OTP</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`aud-${runId}`} checked={audience === 'client'} onChange={() => setAudience('client')} />
          The client types it in the client portal
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`aud-${runId}`} checked={audience === 'staff'} onChange={() => setAudience('staff')} />
          The client reads it to me on a call
        </label>
      </fieldset>
      {needsUsername ? (
        <label className="grid gap-1 text-[12.5px]">
          <span className="text-ink-2">{needsUsername}</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="h-control-sm max-w-[16rem]" aria-label="GST portal username" />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={disabled || consent.isPending || (Boolean(needsUsername) && !username.trim())} onClick={ask}>
          {consent.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Ask for the consent OTP
        </Button>
        {consent.isError ? <ErrorLine>{errText(consent.error)}</ErrorLine> : null}
      </div>
    </div>
  );
}

function EvcAsk({ run, text, disabled, onAct }: { run: GstRunBundle['run']; text: string; disabled: boolean; onAct: (b: GstRunActionBody) => void }) {
  const [audience, setAudience] = useState<'client' | 'staff'>('client');
  const [pan, setPan] = useState('');
  const known = run.flow.signatoryPanMasked;
  const panOk = !pan || PAN_RE.test(pan);
  return (
    <div className="grid gap-2.5">
      <p className="text-ink-2">{text}</p>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5">
        <legend className="sr-only">Who types the EVC OTP</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`evc-${run.id}`} checked={audience === 'client'} onChange={() => setAudience('client')} />
          The signatory types it in the client portal
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`evc-${run.id}`} checked={audience === 'staff'} onChange={() => setAudience('staff')} />
          The signatory reads it to me on a call
        </label>
      </fieldset>
      <label className="grid gap-1 text-[12.5px]">
        <span className="text-ink-2">Authorised signatory’s PAN {known ? <span className="font-mono text-ink-muted">(on file: {known})</span> : '(taken from the GST registration when left empty)'}</span>
        <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} autoComplete="off" className="h-control-sm max-w-[12rem] font-mono" aria-invalid={!panOk} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={disabled || !panOk} onClick={() => onAct({ action: 'evc', audience, signatoryPan: pan || null })}>
          Ask for the EVC OTP
        </Button>
        <Button size="sm" variant="secondary" disabled title="Signing through the API needs the signer’s own DSC token. Not built yet.">
          Sign with DSC (coming)
        </Button>
      </div>
    </div>
  );
}

function Figures({ summary }: { summary: GstReturnSummary }) {
  const t = summary.table;
  const money = summary.form !== 'gstr1';
  return (
    <section aria-label="Portal figures" className="grid gap-2">
      <h4 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Portal’s own figures (from GSTZen)</h4>
      {t.rows.length ? (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[420px] border-collapse text-[13px]">
            <thead className="bg-surface-sunken text-[12px] text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium" />
                {t.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 text-right font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.label} className={cn('border-t border-line-soft', /^(Cash to pay|Total)$/.test(r.label) && 'font-semibold')}>
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {r.label}
                  </th>
                  {r.values.map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right font-mono tabular-nums">
                      {money || i > 0 ? formatInr(v) : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-2">
        {summary.lines.map((l) => (
          <span key={l.label}>
            {l.label}: <span className="font-mono tabular-nums">{l.label.startsWith('E-invoices') ? l.value : `Rs ${formatInr(l.value)}`}</span>
          </span>
        ))}
        {summary.twoB ? <TwoBLine twoB={summary.twoB} /> : summary.form === 'gstr3b' ? <span className="text-ink-muted">GSTR-2B was not read for this period.</span> : null}
      </div>
      {summary.note ? <p className="text-[12.5px] text-ink-muted">{summary.note}</p> : null}
      <p className="text-[11.5px] text-ink-faint">Read {fmtTime(summary.fetchedAt)}</p>
    </section>
  );
}

function TwoBLine({ twoB }: { twoB: NonNullable<GstReturnSummary['twoB']> }) {
  const pct = twoB.itcClaimed > 0 ? Math.min(100, Math.round((Math.min(twoB.itcIn2b, twoB.itcClaimed) / twoB.itcClaimed) * 100)) : 100;
  const off = Math.abs(twoB.difference) >= 1;
  return (
    <span className={cn(off && 'text-warning')}>
      2B matched: {pct}% (ITC in 2B Rs {formatInr(twoB.itcIn2b)}, claimed Rs {formatInr(twoB.itcClaimed)}
      {off ? `, ${twoB.difference > 0 ? 'claimed above 2B by' : 'below 2B by'} Rs ${formatInr(Math.abs(twoB.difference))}` : ''})
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* small parts                                                         */
/* ------------------------------------------------------------------ */

function PeriodPicker({ form, value, onChange, locked }: { form: GstForm; value: string | null; onChange: (v: string) => void; locked: boolean }) {
  const options = periodOptions(form, todayIst());
  if (locked && value) return <span className="text-ink-2">{periodLabelOf(form, value)}</span>;
  return (
    <select
      aria-label="Return period"
      className="h-control-sm rounded-md border-1.5 border-line-strong bg-surface-raised px-2 text-[13px]"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {value && !options.includes(value) ? <option value={value}>{periodLabelOf(form, value)}</option> : null}
      {options.map((p) => (
        <option key={p} value={p}>
          {periodLabelOf(form, p)}
        </option>
      ))}
    </select>
  );
}

/** The last twelve months, or the last four financial years. */
function periodOptions(form: GstForm, today: string): string[] {
  const out: string[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  if (isAnnualForm(form)) {
    const end = m >= 4 ? y : y - 1;
    for (let i = 0; i < 4; i += 1) out.push(`03${end - i}`);
    return out;
  }
  for (let i = 0; i < 12; i += 1) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    out.push(`${String(m).padStart(2, '0')}${y}`);
  }
  return out;
}

function YourTurn({ title, tone, children }: { title: string; tone: 'yours' | 'next' | 'bad' | 'ok'; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className={cn(
        'grid gap-2 rounded-md border px-3.5 py-3',
        tone === 'yours' && 'border-brand/40 bg-brand-soft',
        tone === 'next' && 'border-line bg-surface-raised',
        tone === 'bad' && 'border-danger/30 bg-danger-soft',
        tone === 'ok' && 'border-positive/30 bg-positive-soft',
      )}
    >
      <h4 className={cn('text-[12px] font-semibold uppercase tracking-[0.06em]', tone === 'yours' ? 'text-brand-text' : tone === 'bad' ? 'text-danger' : 'text-ink-muted')}>{title}</h4>
      {children}
    </section>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'warning' | 'danger'; children: ReactNode }) {
  const Icon = tone === 'info' ? Info : tone === 'warning' ? AlertTriangle : CircleAlert;
  return (
    <p className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-[13px]', tone === 'info' && 'bg-info-soft text-ink-2', tone === 'warning' && 'bg-warning-soft text-ink-2', tone === 'danger' && 'bg-danger-soft text-danger')}>
      <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[12.5px] text-danger">
      {children}
    </p>
  );
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

const TIME = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
function fmtTime(iso: string): string {
  return TIME.format(new Date(iso));
}
