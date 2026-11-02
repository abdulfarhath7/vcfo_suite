'use client';

/**
 * NEW PROJECT → NOC — /app/manager/projects/new (prototype a59x_newproj.js,
 * HANDOFF §5; owner's request). The live create-project form's fields and
 * rules (project-form.tsx, a faithful port of CreateProjectForm), laid out as
 * the prototype's wizard: a step rail, the form, and — for an incorporation —
 * the registered-office NOC drawn live beside it.
 *
 * When work starts at Incorporation the wizard also asks for the registered
 * office and the property owner; "Create project and generate the NOC" creates
 * the project (same API as the live form, welcome email included) and then has
 * the server write the NOC as a Word file (src/lib/registered-office-noc).
 * The done screen offers Download, Print or save as PDF, and the project.
 * Field checks: errors block a step; an old bill, an agreement dated after the
 * NOC or a PIN outside the state only warn.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Engagement } from '@/data/engagements';
import { STAGE_LABEL } from '@/components/admin/create-project-form-utils';
import { ENTITY_LEGAL_FORM_LABEL } from '@/lib/compliance/types';
import { questionnaireProgress } from '@/data/compliance-questionnaire';
import {
  blankNocInput,
  coerceNocInput,
  NOC_HOLDINGS,
  NOC_STEP_FIELDS,
  nocAddress,
  nocMissingCount,
  type NocField,
  type NocInput,
} from '@/lib/registered-office-noc/model';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, Icon } from '../../ui';
import { dShort, useToday, useClientPaths } from './shared';
import { ClientFields, EntityFields, QuestionnaireFields, TeamFields, useProjectForm, type ProjectForm } from './project-form';
import {
  generateNoc,
  NocChecks,
  NocOfficeFields,
  NocOwnerFields,
  NocPaper,
  NocPreview,
  NocSigningFields,
  printNoc,
  useNocForm,
  type NocBind,
  type NocDto,
} from './noc';

type StepKey = 'company' | 'team' | 'office' | 'owner' | 'quiz' | 'review';

const STEP_META: Record<StepKey, { label: string; sub: string }> = {
  company: { label: 'Company', sub: 'Name, ownership and start' },
  team: { label: 'Team and client', sub: 'Who runs it, who signs in' },
  office: { label: 'Registered office', sub: 'Address and proof' },
  owner: { label: 'Property owner', sub: 'Who gives the NOC' },
  quiz: { label: 'Questionnaire', sub: 'Optional · compliance answers' },
  review: { label: 'Review and create', sub: 'Check and create' },
};

const NOC_DRAFT_KEY = 'vcfo.create-project.noc-draft.v1';

function loadNocDraft(): NocInput | null {
  try {
    const raw = localStorage.getItem(NOC_DRAFT_KEY);
    return raw ? coerceNocInput(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function NewProjectPage() {
  useCrumbs(['Clients', 'New project']);
  const [round, setRound] = useState(0);
  return <Wizard key={round} onAnother={() => setRound((n) => n + 1)} />;
}

function Wizard({ onAnother }: { onAnother: () => void }) {
  const paths = useClientPaths();
  const { go, toast } = useConsole();
  const today = useToday();
  const p = useProjectForm();
  const inc = p.s.stage === 'Pre-Incorporation';
  const noc = useNocForm(blankNocInput('', today));
  const [nameEdited, setNameEdited] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ engagement: Engagement; noc?: NocDto; nocError?: string } | null>(null);

  // restore the NOC half of a saved draft (the project half is the live form's draft)
  useEffect(() => {
    const d = loadNocDraft();
    if (d) {
      noc.setF(d);
      if (d.companyName.trim()) setNameEdited(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);
  // the NOC prints the project name until it is typed separately
  useEffect(() => {
    if (!nameEdited) noc.bind.set({ companyName: p.s.companyName });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the project name only
  }, [p.s.companyName, nameEdited]);

  const steps: StepKey[] = inc ? ['company', 'team', 'office', 'owner', 'quiz', 'review'] : ['company', 'team', 'quiz', 'review'];
  const cur = steps[Math.min(step, steps.length - 1)]!;
  const nocFields = (k: StepKey): readonly NocField[] => (k === 'office' ? NOC_STEP_FIELDS.office : k === 'owner' ? NOC_STEP_FIELDS.owner : k === 'review' && inc ? NOC_STEP_FIELDS.signing : []);
  const stepOk = (k: StepKey): boolean => {
    if (k === 'company') return p.valid.entity;
    if (k === 'team') return p.valid.team && p.valid.client;
    if (k === 'quiz') return true;
    if (k === 'review') return p.valid.all && (!inc || noc.stepOk(nocFields('review')));
    return noc.stepOk(nocFields(k));
  };
  const mark = (k: StepKey) => {
    // the project fields show their errors once a step with an error is left (the live form: after the first try)
    if ((k === 'company' || k === 'team' || k === 'review') && !stepOk(k)) p.patch({ showValidation: true });
    noc.markAll(nocFields(k));
  };
  const goTo = (i: number) => {
    if (i <= step) return setStep(i);
    for (let j = step; j < i; j++) {
      mark(steps[j]!);
      if (!stepOk(steps[j]!)) {
        setStep(j);
        toast(`Finish ${STEP_META[steps[j]!].label.toLowerCase()} first`);
        return;
      }
    }
    setStep(i);
  };
  const signBind: NocBind = {
    ...noc.bind,
    set: (patch) => {
      if ('companyName' in patch) setNameEdited(true);
      noc.bind.set(patch);
    },
  };

  const saveDraft = () => {
    p.saveDraft();
    try {
      localStorage.setItem(NOC_DRAFT_KEY, JSON.stringify(noc.f));
    } catch {
      /* storage unavailable */
    }
    toast('Draft saved in this browser');
  };
  const discard = () => {
    p.discardDraft();
    try {
      localStorage.removeItem(NOC_DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
    go(paths.list);
  };

  const create = async () => {
    steps.forEach(mark);
    const bad = steps.findIndex((k) => !stepOk(k));
    if (bad >= 0) {
      setStep(bad);
      setErr(bad === steps.length - 1 ? 'A few fields still need you' : `${STEP_META[steps[bad]!].label} still needs you`);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const nocInput = noc.f;
      const out = await p.submit();
      if (!out) {
        setErr('A few fields still need you');
        return;
      }
      let saved: NocDto | undefined;
      let nocError: string | undefined;
      if (inc) {
        try {
          saved = await generateNoc(out.engagement.id, nocInput);
        } catch (e) {
          nocError = e instanceof Error ? e.message : 'Could not generate the NOC';
        }
      }
      try {
        localStorage.removeItem(NOC_DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      setDone({ engagement: out.engagement, noc: saved, nocError });
      toast(inc ? (saved ? 'Project created · NOC generated' : 'Project created · the NOC still needs generating') : 'Project created');
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create the project");
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Done done={done} nocInput={noc.f} onAnother={onAnother} />;

  const missing = nocMissingCount(noc.f);
  const isLast = step >= steps.length - 1;

  return (
    <>
      <div className="sec-h">
        <h2>New project</h2>
        <span className="sec-count">{inc ? 'Incorporation · with the registered office NOC' : `Starts at ${STAGE_LABEL[p.s.stage]}`}</span>
        <span className="sp" />
        <Btn cls="sm" ico="check" onClick={saveDraft} disabled={busy}>
          Save as draft
        </Btn>
        <Btn cls="sm" ico="x" onClick={discard} disabled={busy}>
          Discard
        </Btn>
      </div>
      <section className="glass cx-np">
        <div className="np-wiz">
          <div className="np-head">
            <span className="mx-ni">
              <Icon name="build" />
            </span>
            <div className="mx-dt">
              <h3>{inc ? 'New incorporation project' : 'New project'}</h3>
              <span>{inc ? 'Fill the first details · the NOC for the registered office is generated from them' : 'Fill the details · the client gets the portal invite when you create it'}</span>
            </div>
          </div>
          <div className={'np-body' + (inc ? '' : ' cx-nopv')}>
            <div className="np-rail" role="list" aria-label="Steps">
              {steps.map((k, i) => {
                const ok = i < step && stepOk(k);
                return (
                  <button key={k} type="button" role="listitem" className={'np-rs' + (i === step ? ' on' : '') + (ok ? ' ok' : '')} aria-current={i === step ? 'step' : undefined} onClick={() => goTo(i)}>
                    <span className="np-rn">{ok ? <Icon name="check" size={12} /> : i + 1}</span>
                    <span className="mx-dt">
                      <b>{k === 'review' && inc ? 'Review and generate' : STEP_META[k].label}</b>
                      <span>{STEP_META[k].sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="np-mid">
              <div className="np-form">
                <div className="np-step">
                  <span className="eyebrow">{`Step ${step + 1} of ${steps.length}`}</span>
                  <h3>{cur === 'review' && inc ? 'Review and generate' : STEP_META[cur].label}</h3>
                </div>
                {cur === 'company' ? <EntityFields p={p} /> : null}
                {cur === 'team' ? (
                  <>
                    <div className="np-sh">
                      <h4>Who runs it</h4>
                      <span className="small">You set the dates; the lead runs the steps</span>
                    </div>
                    <TeamFields p={p} />
                    <div className="np-sh">
                      <h4>Client portal</h4>
                      <span className="small">The contact gets the portal invite and the document requests</span>
                    </div>
                    <ClientFields p={p} />
                  </>
                ) : null}
                {cur === 'office' ? <NocOfficeFields b={noc.bind} /> : null}
                {cur === 'owner' ? <NocOwnerFields b={noc.bind} /> : null}
                {cur === 'quiz' ? (
                  <>
                    <div className="np-sh">
                      <h4>Compliance questionnaire</h4>
                      <span className="small">Optional · it shapes the compliance calendar; you can answer it later on Edit project</span>
                    </div>
                    <QuestionnaireFields p={p} />
                  </>
                ) : null}
                {cur === 'review' ? <Review p={p} inc={inc} noc={noc.f} signBind={signBind} onEdit={(k) => setStep(steps.indexOf(k))} /> : null}
                {err ? (
                  <p className="cx-err" role="alert">
                    {err}
                  </p>
                ) : null}
              </div>
              <div className="np-foot">
                {step ? (
                  <Btn ico="back" onClick={() => setStep(step - 1)} disabled={busy}>
                    Back
                  </Btn>
                ) : (
                  <span />
                )}
                <span className="sp" />
                {inc ? <span className="small">{missing ? `${missing} NOC field${missing === 1 ? '' : 's'} left` : 'The NOC is complete'}</span> : null}
                {isLast ? (
                  <Btn cls="pri" ico="check" disabled={busy} onClick={() => void create()}>
                    {busy ? (inc ? 'Creating and generating…' : 'Creating…') : inc ? 'Create project and generate the NOC' : 'Create project'}
                  </Btn>
                ) : (
                  <Btn cls="pri" ico="chev" disabled={busy} onClick={() => goTo(step + 1)}>
                    Continue
                  </Btn>
                )}
              </div>
            </div>
            {inc ? <NocPreview input={noc.f} /> : null}
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- review */

function Review({ p, inc, noc, signBind, onEdit }: { p: ProjectForm; inc: boolean; noc: NocInput; signBind: NocBind; onEdit: (k: StepKey) => void }) {
  const s = p.s;
  const managerNames = s.managerIds
    .filter(Boolean)
    .map((id) => (id === p.selfManagerId && p.lockFirstManager ? 'You' : p.managers.find((m) => m.id === id)?.name))
    .filter(Boolean)
    .join(', ');
  const leadNames = s.internIds
    .filter(Boolean)
    .map((id) => p.owners.find((o) => o.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const q = questionnaireProgress(s.questionnaire);
  const holding = NOC_HOLDINGS.find((h) => h.value === noc.holding);
  const rows: Array<[string, string, StepKey]> = [
    ['Project', `${s.companyName || '—'} · ${ENTITY_LEGAL_FORM_LABEL[s.entityLegalForm]}`, 'company'],
    ['Ownership', p.independent ? 'Standalone' : `${s.companyType === 'foreign' ? 'Foreign' : 'Indian'} subsidiary${s.parentIndianRelationship ? ` · ${s.parentIndianRelationship === 'investing' ? 'investing parent' : 'name use only'}` : ''}`, 'company'],
    ['Start', STAGE_LABEL[s.stage], 'company'],
    ['Team', `${managerNames || 'No manager yet'} · lead ${leadNames || 'not picked'}`, 'team'],
    ['Client', [s.clientContact, s.clientEmail].filter(Boolean).join(' · ') || '—', 'team'],
  ];
  if (inc) {
    rows.push(['Office', nocAddress(noc) || '—', 'office']);
    rows.push(['Holding', `${holding?.label ?? '—'}${(noc.holding === 'rented' || noc.holding === 'leased') && noc.agreementDate ? ` · agreement ${dShort(noc.agreementDate)}` : ''}`, 'office']);
    rows.push(['Proof', `${noc.billType}${noc.billDate ? ` · ${dShort(noc.billDate)}` : ''}`, 'office']);
    rows.push(['Owner', noc.ownerName ? `${noc.ownerTitle} ${noc.ownerName}, ${noc.relation} ${noc.relationName || '…'}` : '—', 'owner']);
  }
  rows.push(['Questionnaire', q.answered ? `${q.answered} of ${q.total} answered` : 'Not answered (optional)', 'quiz']);
  const projectMissing = Object.values(p.fieldErrors).filter(Boolean).length;
  return (
    <>
      <div className="np-sum">
        {rows.map(([l, v, k]) => (
          <div key={l} className="np-sr">
            <span className="mx-fl">{l}</span>
            <b>{v}</b>
            <button type="button" className="link" onClick={() => onEdit(k)}>
              Edit
            </button>
          </div>
        ))}
      </div>
      {projectMissing && s.showValidation ? (
        <div className="np-warn bad" role="note">
          <Icon name="alert" size={14} />
          <span className="mx-dt">
            <b>{projectMissing === 1 ? 'A project field still needs you' : `${projectMissing} project fields still need you`}</b>
            <span>Use Edit on the rows above.</span>
          </span>
        </div>
      ) : null}
      {inc ? (
        <>
          <NocSigningFields b={signBind} />
          <NocChecks f={noc} missingFields={nocMissingCount(noc)} />
        </>
      ) : p.valid.all ? (
        <div className="np-warn ok" role="note">
          <Icon name="check" size={14} />
          <span className="mx-dt">
            <b>Everything is in</b>
            <span>Creating the project sends {s.clientEmail || 'the client'} the portal invite.</span>
          </span>
        </div>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- done */

function Done({ done, nocInput, onAnother }: { done: { engagement: Engagement; noc?: NocDto; nocError?: string }; nocInput: NocInput; onAnother: () => void }) {
  const paths = useClientPaths();
  const { go, toast } = useConsole();
  const [noc, setNoc] = useState<NocDto | undefined>(done.noc);
  const [nocError, setNocError] = useState(done.nocError);
  const [busy, setBusy] = useState(false);
  const eng = done.engagement;
  const inc = Boolean(noc || nocError);
  const projectHref = paths.project(eng);
  const retry = async () => {
    setBusy(true);
    try {
      setNoc(await generateNoc(eng.id, nocInput));
      setNocError(undefined);
      toast('NOC generated');
    } catch (e) {
      setNocError(e instanceof Error ? e.message : 'Could not generate the NOC');
    } finally {
      setBusy(false);
    }
  };
  const input = noc?.input ?? nocInput;
  const steps = useMemo(
    () => [
      `The owner signs the NOC${input.nocDate ? ` on ${dShort(input.nocDate)}` : ''}${input.place ? ` at ${input.place}` : ''}.`,
      `The client uploads the signed NOC and the ${input.billType.toLowerCase()} on Registered Office Address.`,
      'The project lead checks them in step Pre-7, Registered Office Address.',
    ],
    [input],
  );
  return (
    <section className="glass cx-np">
      <div className="np-done">
        <div className="np-dh">
          <span className="np-ok">
            <Icon name="check" size={22} />
          </span>
          <div className="mx-dt">
            <h3>{noc ? 'Project created · NOC generated' : 'Project created'}</h3>
            <span>{`${eng.companyName}${noc ? ' · the owner signs the NOC next' : ' · the client has the portal invite'}`}</span>
          </div>
        </div>
        {inc ? (
          <div className="np-dgrid">
            <div className="np-pw">
              <NocPaper input={input} />
            </div>
            <div className="np-dacts">
              {noc ? (
                <>
                  <div className="np-file">
                    <span className="np-fi">DOCX</span>
                    <span className="mx-dt">
                      <b>{noc.fileName}</b>
                      <span>Word · A4 · Times New Roman 12 · ready to print and sign</span>
                    </span>
                  </div>
                  <a className="btn pri" href={`/api/engagements/${encodeURIComponent(eng.id)}/registered-office-noc/file`} download={noc.fileName}>
                    <Icon name="dl" />
                    Download NOC
                  </a>
                  <Btn ico="doc" onClick={() => printNoc(input, () => toast('Printing is blocked here · use Download NOC instead'))}>
                    Print or save as PDF
                  </Btn>
                </>
              ) : (
                <div className="np-warn bad" role="alert">
                  <Icon name="alert" size={14} />
                  <span className="mx-dt">
                    <b>The NOC could not be generated</b>
                    <span>{nocError}</span>
                  </span>
                </div>
              )}
              {!noc ? (
                <Btn cls="pri" ico="doc" disabled={busy} onClick={() => void retry()}>
                  {busy ? 'Generating…' : 'Generate the NOC again'}
                </Btn>
              ) : null}
              <div className="np-next">
                <span className="eyebrow">What happens next</span>
                <ol>
                  {steps.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
              </div>
              <div className="np-dfoot">
                <Btn ico="build" onClick={onAnother}>
                  Set up another
                </Btn>
                <span className="sp" />
                <Btn cls="pri" ico="grid" onClick={() => go(projectHref)}>
                  Open the project
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          <div className="np-dacts cx-donep">
            <p className="small">The project is in your book. Set the incorporation or step windows on the client page, and the lead starts the first step.</p>
            <div className="np-dfoot">
              <Btn ico="build" onClick={onAnother}>
                Set up another
              </Btn>
              <span className="sp" />
              <Btn cls="pri" ico="grid" onClick={() => go(projectHref)}>
                Open the project
              </Btn>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
