'use client';

/**
 * New-client Master data (prototype #nsec-md + a58b_newc.js renderNewcForm /
 * nMeta): one `.mdsec` card per client-intake step (Part A Client Details and
 * the Part B detail forms — src/lib/pre-inc-direct-flow.ts
 * CLIENT_INTAKE_STEP_IDS), each with its fill progress (n / m required details
 * from the catalog and the real validator) and the REAL step form inside
 * (`<StepWork>`: fill, save, submit to SBC). The side panel lists what is still
 * missing; the sticky `.nbar` shows the overall progress and takes the client
 * to the next step to fill or send. Sending is the step form's own Submit —
 * nothing here submits on its own.
 */
import { useCallback, useMemo, useState } from 'react';
import { usePaletteItems, useNavBadge, usePortal, type PaletteItem } from '../../runtime';
import { fmt } from '../../dates';
import { Btn, Icon, Pill, SecHead, SecLoading } from '../../ui';
import { StepWork } from '../incorporation/StepWork';
import { type IntakeStep } from './model';
import { useNewc } from './useNewc';
import '../../css/95-newc.css';

export const mdTarget = (id: string) => `nmd-${id}`;

function stateText(s: IntakeStep, prevTitle?: string): string {
  const at = s.step.slice?.clientSubmittedAt?.slice(0, 10) ?? s.step.doneOn;
  if (s.state === 'done') return at ? `Accepted · sent ${fmt(at)}` : 'Accepted by SBC';
  if (s.state === 'with') return at ? `Sent to SBC on ${fmt(at)} · SBC is checking it` : 'With SBC · checking';
  if (s.state === 'locked') return prevTitle ? `Opens once ${prevTitle} is done.` : 'Opens once the steps before it are done.';
  return s.ready ? 'Everything is filled · submit it to send it to SBC' : `${s.missing.length} detail${s.missing.length === 1 ? '' : 's'} still needed`;
}

function IntakeCard({ s, prevTitle, onPick }: { s: IntakeStep; prevTitle?: string; onPick: (id: string) => void }) {
  const [show, setShow] = useState(false);
  const forms = (s.step.item.forms ?? []).filter((f) => !/^spice/i.test(f));
  const head = (
    <div className="mdsec-h">
      <h3>{s.title.toUpperCase()}</h3>
      <span className="small">
        {s.part}
        {forms.length ? ` · feeds ${forms.join(', ')}` : ''}
      </span>
      <span className="sp" />
      {s.state === 'locked' ? (
        <Pill kind="mut" icon="lock">
          Not open yet
        </Pill>
      ) : s.state === 'done' ? (
        <Pill kind="ok" icon="check">
          Done
        </Pill>
      ) : s.state === 'with' ? (
        <Pill kind="up" icon="clock">
          With SBC
        </Pill>
      ) : (
        <span className={'pill ' + (s.ready ? 'ok' : 'mut')} title="Required details filled">
          {s.filled} / {s.required}
        </span>
      )}
    </div>
  );
  if (s.state === 'locked')
    return (
      <section className="glass mdsec off" id={mdTarget(s.id)}>
        {head}
        <div className="small">{stateText(s, prevTitle)}</div>
      </section>
    );
  const open = s.state === 'open';
  return (
    <section className="glass mdsec" id={mdTarget(s.id)} onFocusCapture={() => onPick(s.id)} onPointerDown={() => onPick(s.id)}>
      {head}
      {open ? (
        <StepWork stepId={s.id} />
      ) : (
        <div className="nmd-sent">
          <span className="small">{stateText(s)}</span>
          <span className="sp" />
          <button type="button" className="link" aria-expanded={show} onClick={() => setShow((v) => !v)}>
            {show ? 'Hide' : s.state === 'done' ? 'What you sent' : 'Open'}
          </button>
        </div>
      )}
      {!open && show ? <StepWork stepId={s.id} /> : null}
    </section>
  );
}

export function NewcMasterDataSection() {
  const { go, toast } = usePortal();
  const n = useNewc();
  const { intake, totals } = n;
  const [picked, setPicked] = useState<string | null>(null);

  const toStep = useCallback(
    (id: string, focusSubmit?: boolean) => {
      go('nmd', { target: mdTarget(id) });
      if (!focusSubmit) return;
      window.setTimeout(() => {
        const card = document.getElementById(mdTarget(id));
        const btn = [...(card?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => /^\s*submit/i.test(b.textContent ?? ''));
        if (btn) {
          btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
          btn.focus({ preventScroll: true });
        }
      }, 900);
    },
    [go],
  );

  /* ---------- badge, search (step links belong to Incorporation: its walkthrough holds the same real form) */
  useNavBadge('nmd', n.loading ? undefined : totals.open);
  const skipped = n.stage === 'skipped';
  const palette = useMemo<PaletteItem[]>(
    () =>
      (skipped ? [] : intake).map((s) => ({
        id: 'nmd-' + s.id,
        label: s.title,
        kind: s.state === 'open' ? `Master data · ${s.filled}/${s.required}` : s.state === 'locked' ? 'Master data · not open yet' : s.state === 'with' ? 'Master data · with SBC' : 'Master data · done',
        sw: s.state === 'open' ? 'var(--due)' : s.state === 'locked' ? 'var(--line)' : 'var(--ok-green)',
        go: () => toStep(s.id),
      })),
    [intake, toStep, skipped],
  );
  usePaletteItems('newc-md', palette);

  if (n.loading) return <SecLoading label="Loading your master data…" />;

  if (n.stage === 'skipped')
    return (
      <>
        <SecHead title="Master data" />
        <section className="glass panel nwait">
          <Icon name="check" />
          <div>
            <b>Nothing to fill here</b>
            <span className="small">SPICe+ incorporation is not part of your project with SBC, so there are no company or director details to send.</span>
          </div>
        </section>
      </>
    );

  const sel = intake.find((s) => s.id === picked && s.state === 'open') ?? totals.first;
  const first = totals.first;
  /** the step right before one in checklist order (what a locked step waits for) */
  const prevOf = (id: string) => {
    const i = n.model.steps.findIndex((x) => x.id === id);
    return i > 0 ? n.model.steps[i - 1]!.title : undefined;
  };

  return (
    <>
      <SecHead title="Master data" count={totals.required ? `${totals.filled} of ${totals.required} required details` : undefined} />
      <div className="nmd">
        <div id="nform">
          {intake.map((s) => (
            <IntakeCard key={s.id} s={s} prevTitle={prevOf(s.id)} onPick={setPicked} />
          ))}
        </div>
        <aside className="glass panel nprev">
          <div className="ph" style={{ marginBottom: 10 }}>
            <h3>{sel ? 'Still needed' : 'Your details'}</h3>
            <span className="sp" />
            {sel ? <span className="small">{sel.title}</span> : null}
          </div>
          {sel ? (
            sel.missing.length ? (
              <>
                <div className="checks">
                  {sel.missing.slice(0, 14).map((m) => (
                    <button key={m.id} type="button" className="chk nmiss" onClick={() => toStep(sel.id)}>
                      <Icon name="alert" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{m.label}</b>
                        <span>{m.section ? `${m.section} · ${m.message}` : m.message}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {sel.missing.length > 14 ? <p className="small" style={{ marginTop: 8 }}>and {sel.missing.length - 14} more in the form.</p> : null}
              </>
            ) : (
              <div className="banner ok" style={{ marginTop: 0 }}>
                <Icon name="check" />
                <div>
                  <b>{sel.title} is complete</b>
                  <span>Press Submit at the end of the form to send it to SBC.</span>
                </div>
              </div>
            )
          ) : (
            <p className="small">{totals.allSent ? 'Everything is with SBC. Each declaration is prepared from these details.' : 'The next part opens once SBC has finished the step before it.'}</p>
          )}
          <div className="nprev-steps">
            {intake.map((s) => (
              <button key={s.id} type="button" className={'nps' + (sel?.id === s.id ? ' on' : '')} onClick={() => (s.state === 'open' ? setPicked(s.id) : toStep(s.id))}>
                <span className={'dck ' + (s.state === 'done' || s.state === 'with' ? 'ok' : s.state === 'open' ? (s.ready ? 'ok' : 'req') : '')}>
                  <Icon name={s.state === 'locked' ? 'lock' : s.state === 'open' && !s.ready ? 'clock' : 'check'} />
                </span>
                <span className="nps-t">{s.title}</span>
                <span className="small">{s.state === 'open' ? `${s.filled}/${s.required}` : s.state === 'locked' ? 'later' : s.state === 'with' ? 'with SBC' : 'done'}</span>
              </button>
            ))}
          </div>
          <p className="small" style={{ marginTop: 10 }}>
            SBC prepares the board resolution, DIR-2, DIR-8, INC-9 and the SPICe+ forms from these details.
          </p>
        </aside>
      </div>
      {/* the sticky progress bar is for filling; once incorporated there is nothing left to send */}
      {n.stage !== 'pre' ? null : (
      <div className="glass nbar">
        <div className="nb-prog">
          <b>{totals.pct}%</b>
          <div>
            <span>{totals.allSent ? 'All sent to SBC' : totals.open === 0 ? `${totals.filled} of ${totals.required} sent · the next part opens later` : `${totals.filled} of ${totals.required} required details`}</span>
            <div className="lc-pb">
              <i style={{ width: `${totals.pct}%` }} />
            </div>
          </div>
        </div>
        {totals.needing ? (
          <button type="button" className="pill over" onClick={() => first && toStep(first.id)}>
            <Icon name="alert" />
            {first ? `${first.missing.length} to fill · ${first.title}` : `${totals.needing} to fill`}
          </button>
        ) : null}
        <span className="sp" />
        {first ? (
          first.ready ? (
            <Btn
              cls="pri"
              ico="send"
              onClick={() => {
                toStep(first.id, true);
                toast(`Check ${first.title}, then press Submit to send it to SBC`);
              }}
            >
              Send {first.title} to SBC
            </Btn>
          ) : (
            <Btn cls="pri" ico="ne" onClick={() => toStep(first.id)}>
              Continue · {first.title}
            </Btn>
          )
        ) : totals.allSent ? (
          <Btn ico="doc" onClick={() => go('nsign')}>
            Declarations
          </Btn>
        ) : null}
      </div>
      )}
    </>
  );
}
