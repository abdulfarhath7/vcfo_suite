'use client';

/**
 * Monthly status brief drawer (OV-06, FINAL `openBrief`): right drawer
 * (phone: bottom sheet), phases with mini bars, "Waiting on <company>",
 * "In progress", Copy brief + Download PDF (the real C4 brief route).
 * The drawer is a `.cp-tw` island: ST5 marks, Spectrum chips and buttons.
 */
import { useEffect, useRef, useState } from 'react';
import { useAskOptional } from '@/components/ask/ask-context';
import { usePortal } from '../../PortalProvider';
import { phaseHref } from '../../routes';
import { Copy, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, OwnerChip } from '@/components/ui/spectrum-chip';
import { StepMark } from '@/components/ui/step-track';
import { days, fmt, fmtY, reduceMotion, wd } from './ui';
import { PH, dateCell, kd, ownKey, phDoneEnd, phPlan, stepHrefOf, type IncData } from './data';
import { markState, markTone, stepChip } from './spectrum';

export function StatusBrief({ d, onClose }: { d: IncData; onClose: () => void }) {
  const { go, toast, after } = usePortal();
  const ask = useAskOptional();
  const [on, setOn] = useState(false);
  const xRef = useRef<HTMLButtonElement>(null);
  const last = useRef<Element | null>(null);
  const { model, short, today } = d;

  const close = () => {
    setOn(false);
    setTimeout(onClose, reduceMotion() ? 0 : 180);
    (last.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  };
  useEffect(() => {
    last.current = document.activeElement;
    const r = requestAnimationFrame(() => setOn(true));
    const t = setTimeout(() => xRef.current?.focus({ preventScroll: true }), 40);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
      document.removeEventListener('keydown', key, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showAfter = after && Boolean(d.coiDate);
  const youSteps = model.steps.filter((x) => kd(x) === 'you');
  const act = model.steps.filter((x) => kd(x) === 'prog' || kd(x) === 'with');
  const coi = d.coiDate ?? d.coiExpected;
  const nav = (href: string) => {
    close();
    go(href);
  };

  const row = (x: (typeof model.steps)[number]) => (
    <a
      key={x.id}
      href={stepHrefOf(x)}
      className="bp"
      aria-label={`Open step ${x.n} · ${x.title}`}
      onClick={(e) => {
        e.preventDefault();
        nav(stepHrefOf(x));
      }}
    >
      <StepMark state={markState(x)} tone={markTone(x)} label={stepChip(x).label} />
      <span>
        {x.n} · {x.title}
        <small>{dateCell(x, d.coiExpected)}</small>
      </span>
      <OwnerChip owner={ownKey(x) === 'You' ? 'client' : ownKey(x) === 'MCA' ? 'mca' : 'sbc'} label={ownKey(x) === 'You' ? short : undefined} />
    </a>
  );

  const briefText = () => {
    const t = [`Incorporation status brief · ${d.companyName}`];
    for (const p of model.phases) t.push(`Phase ${p.no} · ${PH[p.no - 1]}: ${p.done} of ${p.total} done`);
    return t.join('\n');
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- scrim click closes; Esc handled on document
    <div
      id="ip-brief-scrim"
      className={on ? 'on' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside id="ip-brief" className="cp-tw" role="dialog" aria-modal="true" aria-labelledby="ip-brief-t">
        <div className="bh">
          <StepMark state="now" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b id="ip-brief-t">Monthly status brief</b>
            <small>
              {d.companyName} · as of {fmtY(today)}
            </small>
          </div>
          <Button ref={xRef} size="icon" variant="quiet" className="h-[30px] w-[30px] min-w-0" aria-label="Close status brief" onClick={close}>
            <X size={16} strokeWidth={1.6} aria-hidden />
          </Button>
        </div>
        <div className="bb">
          {showAfter ? (
            <p className="hl">
              Incorporated on <b>{fmtY(d.coiDate)}</b>. SPICe+ is <b>{model.spice.pct}%</b> done. Post-incorporation and Registration are under way.
            </p>
          ) : (
            <p className="hl">
              {d.coiExpected ? (
                <>
                  <b>{Math.max(0, days(today, d.coiExpected))} days</b> to the expected COI ({wd(d.coiExpected)} {fmt(d.coiExpected)}).{' '}
                </>
              ) : null}
              SPICe+ is <b>{model.spice.pct}%</b> done: {model.spice.done} of {model.spice.total} steps.
            </p>
          )}
          <div className="sub-h">Phases</div>
          {model.phases.map((p) => {
            const plan = phPlan(p, coi);
            const endD = p.state === 'done' ? phDoneEnd(p) : plan?.[1];
            return (
              <a
                key={p.id}
                href={phaseHref(p.no)}
                className="bp"
                aria-label={`Open Phase ${p.no} · ${PH[p.no - 1]}`}
                onClick={(e) => {
                  e.preventDefault();
                  nav(phaseHref(p.no));
                }}
              >
                <StepMark state={p.state === 'done' ? 'done' : p.state === 'up' ? 'next' : 'now'} label={p.state === 'done' ? 'Done' : p.state === 'up' ? 'Not started' : 'In progress'} />
                <span>
                  Phase {p.no} · {PH[p.no - 1]}
                  <small>
                    {p.done} of {p.total}
                    {endD ? ` · ${p.state === 'done' ? 'done' : 'ends'} ${fmt(endD)}` : ''}
                  </small>
                  <span className="mini">
                    <i style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
                  </span>
                </span>
                <Chip tone={p.state === 'done' ? 'ok' : p.state === 'up' ? 'idle' : 'prog'} fixed>
                  {p.state === 'done' ? 'Done' : p.state === 'up' ? 'Not started' : 'In progress'}
                </Chip>
              </a>
            );
          })}
          <div className="sub-h">Waiting on {short}</div>
          {youSteps.length ? youSteps.map(row) : <p className="m-0 py-2 text-[13px] text-ink-muted">None</p>}
          <div className="sub-h">In progress</div>
          {act.length ? act.map(row) : <p className="m-0 py-2 text-[13px] text-ink-muted">None</p>}
        </div>
        <div className="bf">
          <Button
            variant="secondary"
            onClick={() => {
              try {
                void navigator.clipboard?.writeText(briefText()).catch(() => undefined);
              } catch {
                /* clipboard blocked */
              }
              toast('Status brief copied');
            }}
          >
            <Copy size={16} strokeWidth={1.6} aria-hidden />
            Copy brief
          </Button>
          <Button
            onClick={() => {
              if (ask?.enabled && ask.features.C4 && d.engagementId) {
                const a = document.createElement('a');
                a.href = `/api/ask/brief?${new URLSearchParams({ engagementId: ask.engagementId ?? d.engagementId })}`;
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();
                toast('Download started · status brief PDF');
              } else toast('The PDF brief is not switched on for your account yet');
            }}
          >
            <Download size={16} strokeWidth={1.6} aria-hidden />
            Download PDF
          </Button>
        </div>
      </aside>
    </div>
  );
}
