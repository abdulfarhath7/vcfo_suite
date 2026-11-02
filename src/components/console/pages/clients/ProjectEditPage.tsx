'use client';

/**
 * EDIT PROJECT — /app/manager/projects/[slug]/edit. The live edit form
 * (src/views/admin/ProjectEdit.tsx → CreateProjectForm with editEngagement):
 * every field the project was created with, the delivery-team diff, the
 * manager change (admins), the questionnaire, and "Request change" of the
 * client's sign-in email (the live ChangeClientDialog; a manager files it
 * for an admin). Same hook as New project (project-form.tsx).
 */
import { useState } from 'react';
import type { Engagement } from '@/data/engagements';
import { ChangeClientDialog } from '@/components/admin/ChangeClientDialog';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, ClientAv, Icon, Panel } from '../../ui';
import { companyInitials } from './model';
import { Island, NotFound, useRouteEngagement, useClientPaths } from './shared';
import { ClientFields, EntityFields, QuestionnaireFields, TeamFields, useProjectForm } from './project-form';

export function ProjectEditPage() {
  const { eng, settled } = useRouteEngagement();
  useCrumbs(['Clients', eng?.companyName ?? '…', 'Edit project']);
  if (!eng) return <NotFound settled={settled} />;
  return <Edit key={eng.id} eng={eng} />;
}

function Edit({ eng }: { eng: Engagement }) {
  const paths = useClientPaths();
  const { go, toast } = useConsole();
  const p = useProjectForm(eng);
  const [changeOpen, setChangeOpen] = useState(false);
  const [err, setErr] = useState('');
  const back = () => go(paths.project(eng));
  const save = async () => {
    setErr('');
    try {
      const out = await p.submit();
      if (!out) {
        setErr('A few fields still need you');
        return;
      }
      toast(`Project updated · ${out.engagement.companyName}`);
      go(paths.project(out.engagement));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't update the project");
    }
  };
  const answered = p.questionnaireDone;
  return (
    <>
      <section className="glass mx-ch">
        <div className="mx-chl">
          <button type="button" className="ib" aria-label={`Back to ${eng.companyName}`} title={`Back to ${eng.companyName}`} onClick={back}>
            <Icon name="back" />
          </button>
          <ClientAv id={eng.id} label={companyInitials(eng.companyName)} big />
          <div className="cx-chm">
            <span className="eyebrow cx-ell">{eng.companyName}</span>
            <h2>Edit project</h2>
            <span className="small">Every field the project was created with. Changes reach the client portal and the documents.</span>
          </div>
        </div>
        <div className="mx-chr">
          <Btn cls="sm" onClick={back} disabled={p.s.submitting}>
            Cancel
          </Btn>
          <Btn cls="sm pri" ico="check" onClick={() => void save()} disabled={p.s.submitting}>
            {p.s.submitting ? 'Saving…' : 'Save changes'}
          </Btn>
        </div>
      </section>

      <div className="mx-row21 cx-edit">
        <div className="mx-col">
          <Panel title="The company" sub="Name, ownership, where work starts and the legal form">
            <fieldset className="cx-fs" disabled={p.s.submitting}>
              <EntityFields p={p} />
            </fieldset>
          </Panel>
          <Panel title="Compliance questionnaire" sub={answered ? 'Answered' : 'Optional · it shapes the compliance calendar'}>
            <QuestionnaireFields p={p} />
          </Panel>
        </div>
        <div className="mx-col">
          <Panel title="Team" sub="The manager sets the dates; the first lead is the primary">
            <fieldset className="cx-fs" disabled={p.s.submitting}>
              <TeamFields p={p} />
            </fieldset>
          </Panel>
          <Panel title="Client portal" sub="The contact and the sign-in the client uses">
            <fieldset className="cx-fs" disabled={p.s.submitting}>
              <ClientFields p={p} onChangeEmail={p.isFirmAdmin || p.isManager ? () => setChangeOpen(true) : undefined} />
            </fieldset>
          </Panel>
          {err ? (
            <p className="cx-err" role="alert">
              {err}
            </p>
          ) : null}
          <div className="cx-savebar">
            <span className="small">{p.s.showValidation && !p.valid.all ? 'A few fields still need you' : 'Nothing is saved until you press Save changes'}</span>
            <span className="sp" />
            <Btn onClick={back} disabled={p.s.submitting}>
              Cancel
            </Btn>
            <Btn cls="pri" ico="check" onClick={() => void save()} disabled={p.s.submitting}>
              {p.s.submitting ? 'Saving…' : 'Save changes'}
            </Btn>
          </div>
        </div>
      </div>

      {changeOpen ? (
        <Island inline>
          <ChangeClientDialog engagement={eng} open onOpenChange={setChangeOpen} mode={p.isFirmAdmin ? 'direct' : 'request'} onDone={p.refetchClients} />
        </Island>
      ) : null}
    </>
  );
}
