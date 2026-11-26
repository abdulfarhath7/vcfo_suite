'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import type { AgentRunItem } from '@/lib/card-agents/overview';
import { portalWindowName } from '@/views/live-portal/attention';
import { AgentStateChip, ROUTE_LABEL } from './agent-run-parts';

/**
 * One run in the control room (MASTER-PLAN.md screen 9): the log of who did what. Fields filled,
 * guard refusals, heals, every "your turn" with who answered it and when, the people who watched
 * the live session with the IP each one came from, and the IP the portal saw. A run the VCFO Assist
 * engine drove also has its evidence log and certifier checks (`AssistRunDetail`), one click away.
 * Nothing here holds a value the agent typed, a password, a captcha or an OTP.
 */

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 border-t border-line-soft py-2 text-[13px] first:border-t-0">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4" aria-label={title}>
      <h3 className="mb-1 text-[13px] font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

const END_REASON: Record<string, string> = {
  done: 'Finished',
  cancelled: 'Cancelled by a person',
  idle: 'Stopped: no activity',
  max_time: 'Stopped: time limit',
  kill_switch: 'Stopped by the kill switch',
  error: 'Stopped by an error',
};

export function AgentRunDetail({
  run,
  onOpenChange,
  onOpenEvidence,
}: {
  run: AgentRunItem | null;
  onOpenChange: (open: boolean) => void;
  /** Opens the VCFO Assist run's evidence log, when the run has one loaded. */
  onOpenEvidence?: (assistRunId: string) => void;
}) {
  const pathname = usePathname();
  if (!run) return null;
  // An open live session can be reopened in its portal tab (the same named window live mode uses).
  const segment = /^\/app\/([^/]+)\//.exec(pathname ?? '')?.[1];
  const liveHref = run.source === 'session' && !run.endedAt && segment ? `/app/${segment}/live-portal/${run.rowId}` : null;
  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      size="lg"
      eyebrow={run.companyName}
      title={`${run.agentName} · ${run.form}`}
      sub={
        <>
          <AgentStateChip run={run} />
          <span>{ROUTE_LABEL[run.route]}</span>
          <span>{when(run.startedAt)}</span>
        </>
      }
      footer={
        <>
          {run.assistRunId && onOpenEvidence ? (
            <Button variant="outline" size="sm" onClick={() => onOpenEvidence(run.assistRunId!)}>
              Evidence and certifier checks
            </Button>
          ) : null}
          {liveHref ? (
            <Link href={liveHref} target={portalWindowName(run.rowId)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open the portal again
            </Link>
          ) : null}
          {run.href ? (
            <Link href={run.href} className={buttonVariants({ size: 'sm' })}>
              {run.action} the card
            </Link>
          ) : null}
        </>
      }
    >
      <Part title="Run">
        <dl>
          <Fact k="Started by">{run.startedBy ?? '—'}</Fact>
          <Fact k="Started">{when(run.startedAt)}</Fact>
          <Fact k="Ended">{run.endedAt ? `${when(run.endedAt)}${run.endReason ? ` · ${END_REASON[run.endReason] ?? run.endReason}` : ''}` : 'Still open'}</Fact>
          <Fact k="Time">{run.minutes} min</Fact>
          <Fact k="Result">{run.result ? <span className="font-mono text-[12.5px]">{run.result}</span> : '—'}</Fact>
          {run.period ? <Fact k="Return period">{run.period}</Fact> : null}
          {run.error ? (
            <Fact k="Error">
              <span className="text-danger">{run.error}</span>
            </Fact>
          ) : null}
        </dl>
      </Part>

      {run.route === 'browser' ? (
        <Part title="Fields">
          <dl>
            <Fact k="Fields filled">
              {run.fieldsDone} of {run.fieldsTotal}
              {run.blanks ? <span className="ml-1 text-ink-muted">· {run.blanks} left for the client&apos;s records</span> : null}
            </Fact>
            <Fact k="Heals">{run.heals ? `${run.heals}${run.healsFailed ? ` (${run.healsFailed} failed)` : ''}` : 'None'}</Fact>
            <Fact k="Guard refusals">{run.refusals.length ? run.refusals.map((r) => `${r.kind}${r.target ? ` (${r.target})` : ''}`).join(', ') : 'None'}</Fact>
          </dl>
        </Part>
      ) : null}

      <Part title="Your turns">
        {run.turns.length === 0 && run.checks.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{run.gate ? `Waiting at: ${run.stateLabel}.` : 'None recorded.'}</p>
        ) : (
          <ul className="grid gap-1 text-[13px]">
            {run.turns.map((t, i) => (
              <li key={`t${i}`} className="border-t border-line-soft py-1.5 first:border-t-0">
                <span className="font-medium text-ink">{t.what}</span>
                <span className="ml-1 text-ink-muted">
                  for {t.audience === 'client' ? 'the client' : 'staff'}, asked {when(t.askedAt)}
                  {t.askedBy ? ` by ${t.askedBy}` : ''}
                </span>
                <span className="block text-ink-2">
                  {t.doneAt ? `Answered ${when(t.doneAt)}${t.doneBy ? ` by ${t.doneBy}` : ''}` : t.status === 'pending' ? 'Waiting' : `Not answered (${t.status})`}
                </span>
              </li>
            ))}
            {run.checks.map((c, i) => (
              <li key={`c${i}`} className="border-t border-line-soft py-1.5 first:border-t-0">
                <span className="font-medium text-ink">{c.label}</span>
                <span className="ml-1 text-ink-muted">
                  by {c.by ?? 'a staff member'}, {when(c.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Part>

      {run.source === 'session' ? (
        <Part title="Live session">
          <dl>
            <Fact k="Portal">{run.portalHost ?? '—'}</Fact>
            <Fact k="Portal login used">{run.portalLogin ?? '—'}</Fact>
            <Fact k="IP the portal saw">{run.egressIp ? <span className="font-mono text-[12.5px]">{run.egressIp}</span> : '—'}</Fact>
            <Fact k="Watched by">
              {run.viewers.length
                ? run.viewers.map((v, i) => (
                    <span key={i} className="block">
                      {v.name ?? 'A staff member'}
                      {v.ip ? <span className="ml-1 font-mono text-[12px] text-ink-muted">{v.ip}</span> : null}
                      <span className="ml-1 text-[12px] text-ink-muted">
                        {when(v.firstAt)} to {when(v.lastAt)}
                      </span>
                    </span>
                  ))
                : '—'}
            </Fact>
          </dl>
        </Part>
      ) : null}

      {run.clientIps.length ? (
        <Part title="Suite saw these IPs">
          <p className="font-mono text-[12.5px] text-ink-2">{run.clientIps.join(', ')}</p>
        </Part>
      ) : null}
    </Modal>
  );
}
