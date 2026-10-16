'use client';

/**
 * Monthly status brief drawer (OV-06, FINAL `openBrief`): right drawer
 * (phone: bottom sheet), phases with mini bars, "Waiting on <company>",
 * "In progress", Copy brief + Download PDF (the real C4 brief route).
 */
import { useEffect, useRef, useState } from 'react';
import { useAskOptional } from '@/components/ask/ask-context';
import { usePortal } from '../../PortalProvider';
import { phaseHref } from '../../routes';
import { BotSay, Ic, Si, days, fmt, fmtY, reduceMotion, wd } from './ui';
import { PH, dateCell, glyph, kd, ownKey, phDoneEnd, phKind, phPlan, stepHrefOf, type IncData } from './data';

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
      <Si k={glyph(x)} />
      <span>
        {x.n} · {x.title}
        <small>{dateCell(x, d.coiExpected)}</small>
      </span>
      <span className={`own ${ownKey(x)}`}>{ownKey(x) === 'You' ? short : ownKey(x)}</span>
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
      <aside id="ip-brief" role="dialog" aria-modal="true" aria-labelledby="ip-brief-t">
        <div className="bh">
          <Si k="prog" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b id="ip-brief-t">Monthly status brief</b>
            <small>
              {d.companyName} · as of {fmtY(today)}
            </small>
          </div>
          <button ref={xRef} type="button" className="sq" aria-label="Close status brief" onClick={close}>
            <Ic n="x" />
          </button>
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
                <Si k={phKind(p)} />
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
                <span className={`chip ${phKind(p)}`}>{p.state === 'done' ? 'Done' : p.state === 'up' ? 'Upcoming' : 'In progress'}</span>
              </a>
            );
          })}
          <div className="sub-h">Waiting on {short}</div>
          {youSteps.length ? youSteps.map(row) : <BotSay text={`Nothing is waiting on ${short}.`} />}
          <div className="sub-h">In progress</div>
          {act.map(row)}
        </div>
        <div className="bf">
          <button
            type="button"
            className="btn"
            onClick={() => {
              try {
                void navigator.clipboard?.writeText(briefText()).catch(() => undefined);
              } catch {
                /* clipboard blocked */
              }
              toast('Status brief copied');
            }}
          >
            <Ic n="copy" />
            Copy brief
          </button>
          <button
            type="button"
            className="btn p"
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
            <Ic n="download" />
            Download PDF
          </button>
        </div>
      </aside>
    </div>
  );
}
