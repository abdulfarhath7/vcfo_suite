'use client';

/**
 * The detail drawer for one item of the leads' work (Team tasks, the week, the
 * mini calendar). It reads live data (`useToday`), so marking a team task done
 * shows at once. Real operations only: open the step, the filings register or
 * the client; draft a reminder; mark a team task done or reopen it
 * (PATCH /api/tasks/:id through the app's `updateTask`).
 */
import { useApp } from '@/context/AppContext';
import { fmtL } from '@/components/portal/dates';

import { Btn, Empty, Icon } from '../../ui';
import { DrawerHead } from '../../overlays';
import { useConsole } from '../../runtime';
import { useToday } from './useToday';
import { HOLDER_LABEL, T_LABEL, T_PILL, age, dShort, mailDraft, stepCode, stepPath } from './model';

export function TeamItemDrawer({ itemId }: { itemId: string }) {
  const { model: m } = useToday();
  const { tasks, updateTask } = useApp();
  const { go, base, closeDrawer, toast } = useConsole();
  const t = m.team.find((x) => x.id === itemId);
  if (!t) {
    return (
      <>
        <DrawerHead title="Item closed" />
        <Empty title="This item is no longer open" sub="It was finished or moved out of the Stage filter." />
      </>
    );
  }
  const c = m.byId[t.clientId]!;
  const step = t.stepId ? c.model.byId[t.stepId] : undefined;
  const filing = t.filingId ? c.filings.find((f) => f.id === t.filingId) : undefined;
  const task = t.taskId ? tasks.find((x) => x.id === t.taskId) : undefined;
  const phase = step ? c.model.phases[step.phaseNo - 1] : undefined;
  const kind = t.kind === 'task' ? 'Team task' : t.kind === 'filing' ? `${filing?.areaLabel ?? ''} filing` : `${phase?.name ?? ''}${step && stepCode(step.id) ? ` · ${stepCode(step.id)}` : ''}`;
  const isCurrent = !!step && c.current?.id === step.id;
  const holdsClient = isCurrent && c.holder === 'client';

  const open = (href: string) => {
    closeDrawer();
    go(href);
  };
  const setDone = (done: boolean) => {
    if (!task) return;
    const prev = task.status;
    updateTask(task.id, { status: done ? 'completed' : 'in-progress' });
    toast(done ? `${t.title} marked done` : `${t.title} reopened`, () => updateTask(task.id, { status: prev }));
  };

  return (
    <>
      <DrawerHead
        eyebrow={`${c.name} · ${kind}`}
        title={t.title}
        chips={
          <>
            <span className={'pill ' + T_PILL[t.st]}>{t.st === 'done' ? 'Done' : `${T_LABEL[t.st]} · ${t.dueLabel}`}</span>
            <span className="pill mut" title="Who is on it">
              {t.leadName}
            </span>
            {t.locked ? (
              <span className="pill up" title="A window you set; the lead can only ask to change it">
                <Icon name="lock" />
                Dates set by you
              </span>
            ) : null}
          </>
        }
      />
      <section className="mx-ds2">
        <div className="mx-dsh">
          <span className="eyebrow">Dates</span>
        </div>
        {step ? (
          step.windowFrom || step.due ? (
            <div className="mx-span">
              <b>{step.windowFrom ? dShort(step.windowFrom, m.today) : 'Open'}</b>
              <i />
              <b>{step.due ? dShort(step.due, m.today) : 'Open'}</b>
              <span className="small">{step.ownWindow ? 'your dates for this step' : 'your incorporation window'}</span>
            </div>
          ) : (
            <span className="small">No dates set for this step. Set windows on the client&apos;s page.</span>
          )
        ) : filing ? (
          <div className="mx-span">
            <b>Due {dShort(filing.due, m.today)}</b>
            {filing.filedOn ? <span className="small">filed {dShort(filing.filedOn, m.today)}</span> : <span className="small">not filed yet</span>}
          </div>
        ) : (
          <span className="small">{t.due ? `Due ${fmtL(t.due)}` : 'No due date'}</span>
        )}
      </section>
      {step ? (
        <section className="mx-ds2">
          <div className="mx-dsh">
            <span className="eyebrow">Where it stands</span>
          </div>
          {isCurrent && c.holder ? (
            <span>
              With <b>{HOLDER_LABEL[c.holder]}</b> for {age(c.heldDays ?? 0)}
              {c.since ? ` · since ${dShort(c.since, m.today)}` : ''}
            </span>
          ) : null}
          {phase ? (
            <span className="small">
              {phase.title} · {phase.done} of {phase.total} done
            </span>
          ) : null}
        </section>
      ) : null}
      {filing ? (
        <section className="mx-ds2">
          <div className="mx-dsh">
            <span className="eyebrow">Filing</span>
          </div>
          <span className="small">
            {filing.row.compliance} · {filing.row.authority} · {filing.row.frequency}
          </span>
        </section>
      ) : null}
      {task?.notes ? (
        <section className="mx-ds2">
          <div className="mx-dsh">
            <span className="eyebrow">Notes</span>
          </div>
          <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {task.notes}
          </p>
        </section>
      ) : null}
      <div className="mx-dfoot">
        {step ? (
          <Btn ico="step" onClick={() => open(stepPath(base, c.e, step.id))}>
            Open step
          </Btn>
        ) : filing ? (
          <Btn ico="calc" onClick={() => open(`${base}/compliances/filings`)}>
            Open filings register
          </Btn>
        ) : (
          <Btn ico="grid" onClick={() => open(c.href)}>
            Open client
          </Btn>
        )}
        {holdsClient && step ? (
          <Btn ico="mail" onClick={() => open(mailDraft(c, step.title, base))}>
            Send reminder
          </Btn>
        ) : null}
        <span className="sp" />
        {task ? (
          t.st === 'done' ? (
            <Btn ico="back" onClick={() => setDone(false)}>
              Reopen
            </Btn>
          ) : (
            <Btn cls="pri" ico="check" onClick={() => setDone(true)}>
              Mark done
            </Btn>
          )
        ) : null}
      </div>
    </>
  );
}
