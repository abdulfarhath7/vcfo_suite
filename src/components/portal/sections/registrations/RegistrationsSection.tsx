'use client';

/**
 * Registrations (prototype body.txt REGISTRATIONS + a35_regs.js): the list of
 * registrations in the agreed groups on the left, one registration's detail on
 * the right with four tabs — Documents, Details, Process, After registration.
 *
 * Real data only:
 *  - the registrations are the checklist's phase-4 steps (src/data/checklist.ts)
 *    with their live state from usePortalIncorporation();
 *  - documents = the step's required papers, SBC's file requests and the files on
 *    record (useIncorporationExtras / useClientDocuments);
 *  - details = the step's own fields as the client may see them;
 *  - process / after = the SBC Registration & Compliance Manual
 *    (src/data/registration-sops.ts), lit by the step's real state;
 *  - the client's actions are the real step flow: <StepWork> and the phase
 *    walkthrough (useStepActions().openStepWizard).
 */
import { useEffect, useMemo, useState } from 'react';
import type { PortalStep } from '@/lib/client-portal/step-model';
import type { DocNode } from '@/lib/client-portal/documents';
import { registrationSopFor, REGISTRATION_AUTHORITY, type RegistrationSop } from '@/data/registration-sops';
import { useNavBadge, usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { useClientDocuments, useIncorporationExtras, usePortalIncorporation } from '../../data';
import { fmt, fmtY } from '../../dates';
import { Btn, GoArrow, Icon, Pill, SecHead, SecLoading, Seg } from '../../ui';
import { useStepActions } from '../incorporation/actions';
import { StepWork, useStepWorkPlan } from '../incorporation/StepWork';
import { answerRows, openInTab, signedUrlFor, stepFiles } from '../incorporation/files';
import {
  groupRegistrations,
  openRequestsFor,
  processStates,
  REG_STATUS,
  regStatus,
  registrationDate,
  registrationReference,
  requiredPapers,
  WHO3,
  type RegStatus,
} from './model';
import { selectRegistration, useRegSelection } from './store';

type Tab = 'docs' | 'fields' | 'process' | 'after';

interface RegRow {
  step: PortalStep;
  status: RegStatus;
  sop?: RegistrationSop;
  openReqs: number;
  /** the step's position in the Registration phase, "01" … */
  no: string;
}

function useRegistrations() {
  const { model, engagement, loading } = usePortalIncorporation();
  const extras = useIncorporationExtras();
  const phase = model.phases[3];
  const rows = useMemo<RegRow[]>(() => {
    if (!phase) return [];
    return phase.steps.map((step, i) => {
      const openReqs = openRequestsFor(step.id, extras.data?.fileRequests).length;
      const sop = registrationSopFor(step.id);
      return { step, status: regStatus(step, openReqs), sop, openReqs, no: String(i + 1).padStart(2, '0') };
    });
  }, [phase, extras.data?.fileRequests]);
  return { rows, engagement, loading: loading || extras.isPending };
}

export function RegistrationsSection() {
  const { go, shell } = usePortal();
  const { rows, loading } = useRegistrations();
  const { stepId: extSel, seq } = useRegSelection();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('docs');

  const applicable = rows.filter((r) => r.status !== 'na');
  const live = applicable.filter((r) => r.status === 'live').length;
  const you = applicable.filter((r) => r.status === 'you').length;

  // default selection: the first one needing the client, else the first with SBC, else the first not done
  const current =
    sel ??
    applicable.find((r) => r.status === 'you')?.step.id ??
    applicable.find((r) => r.status === 'sbc')?.step.id ??
    applicable.find((r) => r.status !== 'live')?.step.id ??
    applicable[0]?.step.id ??
    rows[0]?.step.id ??
    null;

  useEffect(() => {
    if (seq > 0 && extSel) {
      setSel(extSel);
      setTab('docs');
    }
  }, [seq, extSel]);

  useNavBadge('registrations', applicable.length ? `${live}/${applicable.length}` : undefined);

  const palette = useMemo<PaletteItem[]>(
    () =>
      rows.map((r) => ({
        id: `reg:${r.step.id}`,
        label: r.step.title,
        kind: `Registration · ${REG_STATUS[r.status].label}`,
        sw: r.status === 'live' ? 'var(--ok-green)' : r.status === 'you' ? 'var(--due)' : r.status === 'sbc' ? 'var(--ice)' : 'var(--line)',
        go: () => {
          selectRegistration(r.step.id);
          go('registrations');
        },
      })),
    [rows, go],
  );
  usePaletteItems('registrations', palette);

  const groups = useMemo(() => groupRegistrations(rows.map((r) => ({ id: r.step.id, r }))), [rows]);
  const selected = rows.find((r) => r.step.id === current);
  const short = shell?.companyShort || 'your company';

  if (loading && rows.length === 0) {
    return (
      <>
        <SecHead title="Registrations" />
        <SecLoading />
      </>
    );
  }

  if (!rows.length || applicable.length === 0) {
    return (
      <>
        <SecHead title="Registrations" />
        <section className="glass panel">
          <div className="sec-empty">
            {rows.length ? `None of the registrations apply to ${short} right now. SBC re-checks this as the company grows.` : `No registrations are planned for ${short} yet. They appear here once SBC adds them to the checklist.`}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <SecHead title="Registrations" count={`${live} of ${applicable.length} live${you ? ` · ${you} need${you === 1 ? 's' : ''} you` : ''}`}>
        <span className="small">From the SBC Registration &amp; Compliance Manual</span>
      </SecHead>
      <div className="regs">
        <section className="glass" style={{ padding: 8 }} aria-label="Registrations">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="eyebrow" style={{ padding: '10px 12px 4px' }}>
                {g.name}
              </div>
              {g.steps.map(({ r }) => (
                <RegRowButton
                  key={r.step.id}
                  r={r}
                  selected={r.step.id === current}
                  onClick={() => {
                    setSel(r.step.id);
                    if (tab === 'after') setTab('docs');
                  }}
                />
              ))}
            </div>
          ))}
        </section>
        <section className="glass panel">{selected ? <RegDetail r={selected} tab={tab} setTab={setTab} /> : null}</section>
      </div>
    </>
  );
}

function RegRowButton({ r, selected, onClick }: { r: RegRow; selected: boolean; onClick: () => void }) {
  const ref = registrationReference(r.step);
  const date = registrationDate(r.step);
  const sub =
    r.status === 'live'
      ? `${ref ? `${ref.label} ${ref.value}` : 'Registered'}${date ? ` · ${fmtY(date)}` : ''}`
      : r.status === 'sbc'
        ? `With SBC${r.step.since ? ` since ${fmt(r.step.since)}` : ''}${r.step.due ? ` · due ${fmt(r.step.due)}` : ''}`
        : r.status === 'you'
          ? r.openReqs
            ? `${r.openReqs} paper${r.openReqs === 1 ? '' : 's'} from you`
            : 'Waiting on you'
          : r.status === 'queued'
            ? r.step.due
              ? `Opens later · planned by ${fmt(r.step.due)}`
              : 'Opens later'
            : 'Not needed';
  return (
    <button type="button" className={'regrow' + (selected ? ' sel' : '') + ' st-' + r.status} aria-pressed={selected} onClick={onClick}>
      <span className="rno">{r.no}</span>
      <div style={{ minWidth: 0 }}>
        <b>{r.step.title}</b>
        <span>{sub}</span>
      </div>
      {r.step.late && r.status !== 'live' && r.status !== 'na' ? <Pill kind="over">Late</Pill> : <Pill kind={REG_STATUS[r.status].pill}>{REG_STATUS[r.status].label}</Pill>}
    </button>
  );
}

/* ---------------------------------------------------------------- detail */

function RegDetail({ r, tab, setTab }: { r: RegRow; tab: Tab; setTab: (t: Tab) => void }) {
  const { shell, openChat } = usePortal();
  const { openStepWizard } = useStepActions();
  const plan = useStepWorkPlan(r.step.id);
  const { engagement } = usePortalIncorporation();
  const extras = useIncorporationExtras();
  const docsQ = useClientDocuments();
  const s = r.step;
  const sop = r.sop;
  const short = shell?.companyShort || 'your company';
  const auth = REGISTRATION_AUTHORITY[s.id];
  const ref = registrationReference(s);
  const date = registrationDate(s);

  const requests = useMemo(() => (extras.data?.fileRequests ?? []).filter((q) => q.stepId === s.id), [extras.data, s.id]);
  const files = useMemo(() => stepFiles(s, engagement?.ownershipType), [s, engagement?.ownershipType]);
  const shared = useMemo<DocNode[]>(() => (docsQ.data?.nodes ?? []).filter((n) => n.stepId === s.id && n.source === 'index' && !n.replaced), [docsQ.data, s.id]);
  const papers = requiredPapers(s);
  const answers = useMemo(() => answerRows(s, engagement?.ownershipType, new Set(files.map((f) => f.fieldId))), [s, engagement?.ownershipType, files]);
  const filled = answers.filter((a) => a.value !== '—').length;
  const received = requests.filter((q) => q.fulfilledAt).length + files.length + shared.length;
  const docTotal = received + requests.filter((q) => !q.fulfilledAt).length + (s.kind === 'done' ? 0 : papers.length);

  const banner: [string, 'check' | 'clock' | 'alert', string, string] =
    r.status === 'live'
      ? ['ok', 'check', ref ? `${ref.label}: ${ref.value}` : 'Registered', `${date ? `Issued ${fmtY(date)}. ` : ''}${files.length || shared.length ? 'The certificate is in Documents.' : 'SBC has the registration in hand.'}`]
      : r.status === 'sbc'
        ? ['info', 'clock', s.owner === 'mca' ? 'With the department' : 'With SBC', `${sop ? `${sop.team} is working on it` : 'SBC is working on it'}${s.since ? ` since ${fmt(s.since)}` : ''}${s.due ? ` · planned by ${fmt(s.due)}` : ''}.`]
        : r.status === 'you'
          ? [s.late ? 'over' : 'due', s.late ? 'alert' : 'clock', 'Waiting on you', r.openReqs ? `${r.openReqs} document${r.openReqs === 1 ? '' : 's'} before SBC can apply.` : 'Your part is below.']
          : r.status === 'queued'
            ? ['info', 'clock', 'Queued', s.gate.message ?? 'Opens later in the sequence.']
            : ['info', 'check', `Not needed for ${short}`, 'SBC marked this registration as not applicable. It re-checks as the company grows.'];

  const tabs = [
    { value: 'docs' as Tab, label: 'Documents', n: `${received}/${docTotal}` },
    { value: 'fields' as Tab, label: 'Details', n: answers.length ? `${filled}/${answers.length}` : undefined },
    { value: 'process' as Tab, label: 'Process', n: sop ? `${sop.process.length} steps` : undefined },
    { value: 'after' as Tab, label: 'After registration' },
  ];

  return (
    <>
      <div className="sd-h" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span className="rno big">{r.no}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span className="eyebrow">{[sop?.team ?? auth?.authority ?? 'SBC', s.item.forms.length ? s.item.forms.join(' · ') : null].filter(Boolean).join(' · ')}</span>
          <h3>{s.title}</h3>
          {sop?.full ? <div className="small">{sop.full}</div> : null}
        </div>
        {auth?.portal ? <GoArrow label={auth.portal.label} href={auth.portal.url} /> : null}
      </div>
      <div className={'banner ' + banner[0]}>
        <Icon name={banner[1]} />
        <div>
          <b>{banner[2]}</b>
          <span>{banner[3]}</span>
        </div>
      </div>
      {sop ? (
        <p className="small" style={{ marginTop: 10 }}>
          Applies when: {sop.applicability}
        </p>
      ) : s.item.notes || s.item.description ? (
        <p className="small" style={{ marginTop: 10 }}>
          {s.item.description ?? s.item.notes}
        </p>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <Seg options={tabs} value={tab} onChange={setTab} ariaLabel="Registration tabs" />
      </div>
      <div key={tab} className="regtab fadein">
        {tab === 'docs' ? (
          <DocsTab r={r} requests={requests} files={files} shared={shared} papers={papers} />
        ) : tab === 'fields' ? (
          <FieldsTab r={r} answers={answers} />
        ) : tab === 'process' ? (
          <ProcessTab r={r} hasReference={Boolean(ref)} />
        ) : (
          <AfterTab r={r} />
        )}
      </div>
      {plan.actionable && r.status !== 'na' ? (
        <div className="reg-foot" style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Your part
          </div>
          <StepWork stepId={s.id} />
        </div>
      ) : null}
      <div className="reg-foot">
        <span className="small">
          {r.status === 'live'
            ? 'Complete.'
            : r.status === 'you'
              ? plan.actionable
                ? 'Everything SBC needs from you is above.'
                : 'SBC has asked for your side; open the walkthrough to see it.'
              : r.status === 'sbc'
                ? 'Nothing for you to do right now.'
                : r.status === 'queued'
                  ? 'Opens once the registration before it is done.'
                  : ''}
        </span>
        <span className="sp" />
        <Btn ico="chat" onClick={() => openChat(`What is ${s.title} and what does ${short} need for it?`)}>
          Ask VCFO
        </Btn>
        {r.status !== 'na' ? (
          <Btn cls="pri" ico="step" onClick={() => openStepWizard(s.id)}>
            Step by step
          </Btn>
        ) : null}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- tabs */

function DocsTab({
  r,
  requests,
  files,
  shared,
  papers,
}: {
  r: RegRow;
  requests: ReturnType<typeof openRequestsFor>;
  files: ReturnType<typeof stepFiles>;
  shared: DocNode[];
  papers: string[];
}) {
  const { toast } = usePortal();
  const done = r.step.kind === 'done';
  const open = requests.filter((q) => !q.fulfilledAt);
  const answered = requests.filter((q) => q.fulfilledAt);
  const sop = r.sop;
  const nothing = !open.length && !answered.length && !files.length && !shared.length && !papers.length;
  return (
    <div>
      {open.length ? (
        <>
          <div className="eyebrow" style={{ margin: '12px 0 6px' }}>
            SBC asked you for
          </div>
          {open.map((q) => (
            <div key={q.id} className="rdoc">
              <span className={'dck ' + (q.dueDate && q.dueDate < new Date().toISOString().slice(0, 10) ? 'over' : 'req')}>!</span>
              <div style={{ minWidth: 0 }}>
                <b>{q.label}</b>
                <span>
                  {q.note ? `${q.note} · ` : ''}
                  {q.requestedByName ? `Asked by ${q.requestedByName}` : 'Asked by SBC'}
                  {q.dueDate ? ` · by ${fmt(q.dueDate)}` : ''}
                </span>
              </div>
              <Pill kind="due">Upload below</Pill>
            </div>
          ))}
        </>
      ) : null}
      {answered.length || files.length || shared.length ? (
        <>
          <div className="eyebrow" style={{ margin: '12px 0 6px' }}>
            On file
          </div>
          {answered.map((q) => (
            <div key={q.id} className="rdoc done">
              <span className="dck ok">
                <Icon name="check" />
              </span>
              <div style={{ minWidth: 0 }}>
                <b>{q.label}</b>
                <span>
                  {q.fileName ?? 'Uploaded'}
                  {q.fulfilledAt ? ` · ${fmt(q.fulfilledAt.slice(0, 10))}` : ''}
                  {q.fulfilledByName ? ` · ${q.fulfilledByName}` : ''}
                </span>
              </div>
              {q.fulfilledPath ? (
                <Btn cls="sm" ico="eye" onClick={() => openInTab(() => signedUrlFor(q.fulfilledPath!), toast)}>
                  Open
                </Btn>
              ) : null}
            </div>
          ))}
          {files.map((f) => (
            <div key={f.fieldId} className="rdoc done">
              <span className="dck ok">
                <Icon name="check" />
              </span>
              <div style={{ minWidth: 0 }}>
                <b>{f.label}</b>
                <span>{f.fileName}</span>
              </div>
              <Btn cls="sm" ico="eye" onClick={() => openInTab(() => signedUrlFor(f.path), toast)}>
                Open
              </Btn>
            </div>
          ))}
          {shared.map((n) => (
            <div key={n.id} className="rdoc done">
              <span className="dck ok">
                <Icon name="check" />
              </span>
              <div style={{ minWidth: 0 }}>
                <b>{n.label}</b>
                <span>
                  {n.from}
                  {n.date ? ` · ${fmt(n.date.slice(0, 10))}` : ''}
                </span>
              </div>
              {n.ref ? (
                <Btn cls="sm" ico="eye" onClick={() => openInTab(`/api/client/documents/file?ref=${encodeURIComponent(n.ref!)}`, toast)}>
                  Open
                </Btn>
              ) : null}
            </div>
          ))}
        </>
      ) : null}
      {papers.length ? (
        <>
          <div className="eyebrow" style={{ margin: '12px 0 6px' }}>
            {done ? 'Papers this registration used' : 'Papers SBC collects for it'}
          </div>
          {papers.map((p) => (
            <div key={p} className={'rdoc' + (done ? ' done' : '')}>
              <span className={'dck ' + (done ? 'ok' : 'prog')}>{done ? <Icon name="check" /> : <Icon name="clock" />}</span>
              <div style={{ minWidth: 0 }}>
                <b>{p}</b>
                <span>{done ? 'Provided' : r.status === 'queued' ? 'Collected when this registration opens' : 'From your incorporation file, or SBC asks you for it'}</span>
              </div>
            </div>
          ))}
        </>
      ) : null}
      {nothing ? <p className="small" style={{ margin: '12px 0' }}>Nothing is on file for this registration yet.</p> : null}
      {sop ? (
        <details style={{ marginTop: 14 }}>
          <summary className="small" style={{ cursor: 'pointer' }}>
            The manual’s checklist for {sop.name}
          </summary>
          {sop.documents.map((g) => (
            <div key={g.group} style={{ marginTop: 8 }}>
              <div className="eyebrow" style={{ margin: '6px 0 4px' }}>
                {g.group}
              </div>
              <div className="small">{g.items.join(' · ')}</div>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}

function FieldsTab({ r, answers }: { r: RegRow; answers: ReturnType<typeof answerRows> }) {
  const { toast } = usePortal();
  if (!answers.length) {
    return (
      <p className="small" style={{ margin: '12px 0' }}>
        SBC records this registration’s details on the step itself; there are no separate fields to show here.
      </p>
    );
  }
  return (
    <div>
      <p className="small" style={{ margin: '10px 0 4px' }}>
        {r.status === 'live' ? 'As recorded by SBC on the registration.' : r.status === 'you' ? 'SBC fills the application from these, so nothing is typed twice.' : 'What SBC has recorded so far.'}
      </p>
      {answers.map((a) => (
        <div key={a.label} className="kv" style={{ gridTemplateColumns: 'minmax(120px, 220px) minmax(0, 1fr) auto' }}>
          <span className="k">{a.label}</span>
          <span className="v" style={a.value === '—' ? { color: 'var(--ink-3)', fontWeight: 500 } : undefined}>
            {a.value}
          </span>
          {a.file ? (
            <Btn cls="sm" ico="eye" onClick={() => openInTab(() => signedUrlFor(a.file!), toast)}>
              Open
            </Btn>
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );
}

function ProcessTab({ r, hasReference }: { r: RegRow; hasReference: boolean }) {
  const sop = r.sop;
  if (!sop) {
    return (
      <p className="small" style={{ margin: '12px 0' }}>
        {r.step.item.description ?? r.step.item.notes ?? 'SBC handles this registration end to end.'} The SBC manual has no step-by-step SOP for this one yet; ask VCFO or your project lead for the procedure.
      </p>
    );
  }
  const states = processStates(sop, r.status, hasReference);
  return (
    <div className="rproc">
      {sop.process.map((p, i) => {
        const st = states[i]!;
        const w = WHO3[p.who];
        return (
          <div key={p.name + i} className={'rstep ' + st}>
            <span className={'nd ' + (st === 'done' ? 'done' : st === 'now' ? 'prog' : st === 'na' ? 'na' : 'up')}>{st === 'done' ? <Icon name="check" /> : String(i + 1)}</span>
            <b>{p.name}</b>
            <span className="who3" style={{ background: w.bg, color: w.ink }}>
              {w.label}
            </span>
          </div>
        );
      })}
      <p className="small" style={{ marginTop: 10 }}>
        {sop.conclusion}
      </p>
    </div>
  );
}

function AfterTab({ r }: { r: RegRow }) {
  const { go } = usePortal();
  const sop = r.sop;
  if (!sop) {
    return (
      <p className="small" style={{ margin: '12px 0' }}>
        The SBC manual lists no post-registration schedule for this one. Anything recurring that SBC tracks for it shows in your{' '}
        <button type="button" onClick={() => go('calendar')} style={{ textDecoration: 'underline', color: 'inherit', font: 'inherit' }}>
          Compliance calendar
        </button>
        .
      </p>
    );
  }
  return (
    <div>
      <p className="small" style={{ margin: '10px 0 6px' }}>
        What SBC keeps doing for you once this is live. The filings SBC tracks for it are in your{' '}
        <button type="button" onClick={() => go('calendar')} style={{ textDecoration: 'underline', color: 'inherit', font: 'inherit' }}>
          Compliance calendar
        </button>
        .
      </p>
      <table className="rtab">
        <tbody>
          {sop.after.map((a) => (
            <tr key={a.compliance}>
              <td>{a.compliance}</td>
              <td>{a.due}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
