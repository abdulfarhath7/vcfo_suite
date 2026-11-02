'use client';

/**
 * LEAD · REGISTRATIONS (prototype #lsec-regs / renderLeadRegs): Phase 4 of the
 * checklist across the lead's incorporated clients, from the real step model.
 * The gate opens one step at a time, so each client has at most one
 * registration in hand; Done keeps the history. The stage bar is the tool's
 * own registration workflow (Collection · Client → Filing · VCFO → Approval ·
 * Department, `workflowStage` on the step) — the prototype's five invented
 * stages are not used. Every row opens its step page, where the work is done.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { getItem } from '@/data/checklist';
import { coerceRegistrationWorkflowStage, REGISTRATION_WORKFLOW_STAGES, registrationWorkflowShortLabel } from '@/lib/incorporation/registration-workflow';
import type { PortalStep } from '@/lib/client-portal/step-model';
import { SecLoading } from '@/components/portal/ui';
import { Btn, Empty, GoArrow, Seg, hueOf } from '../../ui';
import { useConsole, useCrumbs } from '../../runtime';
import { HOLDER_LABEL, age, dShort, mailDraft, plural, stepCode, stepPath, type TClient } from '../today/model';
import { useLeadDesk } from './useLead';
import '../../css/96-today.css';
import '../../css/96-lead.css';

type Filter = 'open' | 'done' | 'all';
interface Row {
  key: string;
  c: TClient;
  s: PortalStep;
}

function stateOf(r: Row, today: string): { label: string; pill: string } {
  if (r.s.kind === 'done') return { label: r.s.doneOn ? `Done ${dShort(r.s.doneOn, today)}` : 'Done', pill: 'ok' };
  if (r.s.late) return { label: `${r.s.lateDays} days late`, pill: 'over' };
  if (r.s.kind === 'you' || r.s.kind === 'prog') return { label: 'Waiting on client', pill: 'mut' };
  if (r.s.kind === 'with') return { label: 'In progress', pill: 'up' };
  return { label: 'Not started', pill: 'na' };
}

function Stages({ s, big }: { s: PortalStep; big?: boolean }) {
  const cur = coerceRegistrationWorkflowStage(s.slice?.workflowStage);
  const at = s.kind === 'done' ? 3 : cur ? REGISTRATION_WORKFLOW_STAGES.indexOf(cur) : s.kind === 'up' || s.kind === 'next' ? -1 : 0;
  return (
    <div className={'stg5' + (big ? ' big' : '')} aria-label={s.kind === 'done' ? 'Done' : cur ? registrationWorkflowShortLabel(cur) : 'Not started'}>
      {REGISTRATION_WORKFLOW_STAGES.map((st, i) => (
        <span key={st} className={i < at ? 'd' : i === at ? 'n' : ''} title={registrationWorkflowShortLabel(st)} />
      ))}
    </div>
  );
}

export function RegistrationsPage() {
  useCrumbs(['Registrations']);
  const { model: m, loading } = useLeadDesk();
  const { go, base } = useConsole();
  const [filter, setFilter] = useState<Filter>('open');
  const [sel, setSel] = useState('');

  const clients = m.clients.filter((c) => c.stage === 'cmp');
  const all: Row[] = clients.flatMap((c) => (c.model.phases[3]?.steps ?? []).map((s) => ({ key: `${c.id}:${s.id}`, c, s })));
  const open = all.filter((r) => r.s.kind === 'you' || r.s.kind === 'prog' || r.s.kind === 'with');
  const done = all.filter((r) => r.s.kind === 'done').sort((a, b) => (b.s.doneOn ?? '').localeCompare(a.s.doneOn ?? ''));
  const rows = filter === 'open' ? open : filter === 'done' ? done : all;
  useEffect(() => {
    if (!rows.some((r) => r.key === sel)) setSel(rows[0]?.key ?? '');
  }, [rows, sel]);
  const r = rows.find((x) => x.key === sel);
  const waitingClient = open.filter((x) => x.s.kind === 'you' || x.s.kind === 'prog').length;

  return (
    <>
      <div className="sec-h">
        <h2>Registrations</h2>
        <span className="sec-count">{loading ? 'Loading…' : `${open.length} in hand · ${waitingClient} waiting on clients · ${done.length} done`}</span>
        <span className="sp" />
        <Seg<Filter>
          className="sm"
          ariaLabel="Show registrations"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'In hand', n: open.length },
            { value: 'done', label: 'Done', n: done.length },
            { value: 'all', label: 'All', n: all.length },
          ]}
        />
      </div>
      {loading ? (
        <SecLoading label="Loading registrations…" />
      ) : clients.length === 0 ? (
        <section className="glass panel">
          <Empty title="No incorporated client in this view" sub="Registrations start once a client has its certificate of incorporation." />
        </section>
      ) : (
        <div className="regs">
          <section className="glass" style={{ padding: 8 }} id="lreglist" aria-label="Registrations">
            {rows.length === 0 ? (
              <Empty title={filter === 'open' ? 'Nothing in hand' : 'Nothing here'} sub={filter === 'open' ? 'Every client is past or before its registration step.' : 'Registrations show here as they move.'} />
            ) : (
              rows.map((x) => {
                const st = stateOf(x, m.today);
                return (
                  <button key={x.key} type="button" className={'regrow' + (x.key === sel ? ' sel' : '')} aria-pressed={x.key === sel} onClick={() => setSel(x.key)}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                      <span className="cc" style={{ ['--cc' as string]: hueOf(x.c.id) } as CSSProperties} title={x.c.name}>
                        <i />
                        {x.c.short}
                      </span>
                      <span className={'pill ' + st.pill + ' tdy-pillsm'} style={{ marginLeft: 'auto' }}>
                        {st.label}
                      </span>
                    </div>
                    <b title={x.s.title}>{x.s.title}</b>
                    <Stages s={x.s} />
                  </button>
                );
              })
            )}
          </section>
          <section className="glass panel" aria-live="polite">
            {r ? <Detail r={r} base={base} go={go} today={m.today} /> : <span className="small">Pick a registration on the left.</span>}
          </section>
        </div>
      )}
    </>
  );
}

function Detail({ r, base, go, today }: { r: Row; base: string; go: (h: string) => void; today: string }) {
  const item = getItem(r.s.id);
  const cur = coerceRegistrationWorkflowStage(r.s.slice?.workflowStage);
  const st = stateOf(r, today);
  const isCurrent = r.c.current?.id === r.s.id;
  const code = stepCode(r.s.id);
  return (
    <>
      <div className="sd-h">
        <span className="cc" style={{ ['--cc' as string]: hueOf(r.c.id) } as CSSProperties} title={r.c.name}>
          <i />
          {r.c.short}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span className="eyebrow">{[code, item?.forms.join(', ')].filter(Boolean).join(' · ')}</span>
          <h3>{r.s.title}</h3>
        </div>
        <GoArrow label="Open step" onClick={() => go(stepPath(base, r.c.e, r.s.id))} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Stages s={r.s} big />
      </div>
      <div className="small" style={{ marginTop: 6 }}>
        {r.s.kind === 'done'
          ? `Done${r.s.doneOn ? ` on ${dShort(r.s.doneOn, today)}` : ''}`
          : cur
            ? `Stage ${REGISTRATION_WORKFLOW_STAGES.indexOf(cur) + 1} of 3 · ${registrationWorkflowShortLabel(cur)}`
            : st.label}
        {isCurrent && r.c.holder ? ` · with ${HOLDER_LABEL[r.c.holder]} for ${age(r.c.heldDays ?? 0)}` : ''}
        {r.s.due ? ` · window ends ${dShort(r.s.due, today)}` : ''}
      </div>
      <div className="lreg2">
        <div>
          <div className="eyebrow" style={{ margin: '14px 0 6px' }}>
            What the client provides
          </div>
          {item?.infoRequired.length ? (
            <ul className="tdy-req">
              {item.infoRequired.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : (
            <span className="small">Nothing listed for this step.</span>
          )}
        </div>
        <div>
          <div className="eyebrow" style={{ margin: '14px 0 6px' }}>
            About this registration
          </div>
          {item?.description ? <p className="small" style={{ margin: 0 }}>{item.description}</p> : null}
          {item?.expectedTimeline ? (
            <div className="small" style={{ marginTop: 8 }}>
              Usual time: {item.expectedTimeline}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Btn cls="pri" ico="step" onClick={() => go(stepPath(base, r.c.e, r.s.id))}>
              Open step
            </Btn>
            {isCurrent && r.c.holder === 'client' ? (
              <Btn ico="mail" onClick={() => go(mailDraft(r.c, r.s.title, base))}>
                Send reminder
              </Btn>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
