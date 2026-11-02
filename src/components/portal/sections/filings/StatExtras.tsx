'use client';

/**
 * The D-4 extras of one statutory period for the client (COMPLIANCE-MODEL.md
 * 4.2, docs/ui-port/COMPLIANCE-API.md § 3): GET /api/compliances/statutory/:instanceId
 * through Farhath's `useStatExtras`, which already drops escalations and the
 * admin's confirm note.
 *
 *  - <StatExtrasBlock f> is ONE line inside the filing card (actions.tsx): the
 *    stage SBC recorded, the owner, the step count, and a link to the full card;
 *  - <StatExtrasCard f> is the pushed, wide card: Progress (steps with who, when
 *    and evidence), the stage and owner, Reminders (no escalations), the Rule
 *    (due rule, applies to, penalty, frequency, note) and Activity.
 *
 * A line from SBC's compliance calendar (`fromCalendar`) is not an instance and
 * shows nothing here.
 */
import type { PortalFiling } from '@/lib/client-portal/compliances';
import { useStatExtras } from '@/components/client-portal/pages/compliances/task-api';
import { usePortal } from '../../runtime';
import { todayIso } from '../../dates';
import { PopHead } from '../../overlays';
import { Btn, LawChip } from '../../ui';
import { dueWords } from '../obligations/model';
import { ActivityList, Av, Block, EmptyLine, ReminderList, StepList, WordPill } from '../obligations/bits';
import '../../css/95-obligations.css';

export function StatExtrasBlock({ f }: { f: PortalFiling }) {
  const { openPop } = usePortal();
  const q = useStatExtras(f.fromCalendar ? null : f.id);
  if (f.fromCalendar) return null;
  const d = q.data;
  const doneN = d?.steps.filter((s) => s.state === 'done').length ?? 0;
  return (
    <div className="fc-now se-line">
      <span>
        {d ? (
          <>
            <b>{d.stageLabel ?? 'Not started'}</b>
            {d.owner ? ` · with ${d.owner}` : ''}
            {d.steps.length ? ` · ${doneN} of ${d.steps.length} steps` : ''}
          </>
        ) : q.isError ? (
          'The details are not available right now.'
        ) : (
          'Loading the details…'
        )}
      </span>
      <span className="sp" />
      <button type="button" style={{ color: 'var(--ice)', fontWeight: 600, padding: 0 }} onClick={() => openPop(null, <StatExtrasCard f={f} />, { push: true, cls: 'wide' })}>
        Progress, reminders and rule
      </button>
    </div>
  );
}

export function StatExtrasCard({ f }: { f: PortalFiling }) {
  const q = useStatExtras(f.id);
  const today = todayIso();
  const d = q.data;
  const done = Boolean(f.filedOn);
  const sub = `${f.period} · ${f.authorityName} · ${dueWords(f.dueDate, today, done, 'Filed')}`;
  return (
    <div>
      <PopHead title={f.name} sub={sub} lead={<LawChip law={f.area} />} />
      {q.isPending ? (
        <p className="small" style={{ marginTop: 12 }}>
          Loading the details…
        </p>
      ) : q.isError || !d ? (
        <>
          <p className="small" style={{ marginTop: 12, color: 'var(--over-ink)' }}>
            The details of this period could not load.
          </p>
          <div className="fc-acts">
            <Btn cls="sm" onClick={() => void q.refetch()}>
              Try again
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div className="fc-chips" style={{ marginTop: 10 }}>
            <WordPill word={d.word} />
            {d.stageLabel ? <span className="small">Stage: {d.stageLabel}</span> : null}
          </div>
          <Block title="Progress" count={d.steps.length ? `${d.steps.filter((s) => s.state === 'done').length} of ${d.steps.length}` : undefined}>
            <StepList steps={d.steps} />
            <div className="tv-kv" style={{ padding: '10px 2px 0' }}>
              <span className="k">With SBC</span>
              {d.owner ? (
                <b>
                  <Av name={d.owner} />
                  <span>{d.owner}</span>
                </b>
              ) : (
                <b>SBC</b>
              )}
            </div>
          </Block>
          <Block title="Reminders" count={d.reminders.length || undefined}>
            <ReminderList rows={d.reminders} />
            {d.remindersBlockedBy.length ? <EmptyLine>Reminders start once SBC completes the set-up.</EmptyLine> : null}
          </Block>
          <Block title="Rule">
            {d.rule ? (
              <div>
                <div className="se-kv">
                  <span className="k">Due rule</span>
                  <span className="v">{d.rule.dueRule ?? '—'}</span>
                </div>
                <div className="se-kv">
                  <span className="k">Applies to</span>
                  <span className="v">{d.rule.applies ?? '—'}</span>
                </div>
                <div className="se-kv">
                  <span className="k">Penalty</span>
                  <span className="v">{d.rule.penalty ?? '—'}</span>
                </div>
                <div className="se-kv">
                  <span className="k">Frequency</span>
                  <span className="v">{f.freqLabel}</span>
                </div>
                {d.rule.note ? (
                  <div className="se-kv">
                    <span className="k">Note</span>
                    <span className="v">{d.rule.note}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyLine>SBC has not written the rule for this filing yet.</EmptyLine>
            )}
          </Block>
          <Block title="Activity" count={d.history.length || undefined}>
            <ActivityList rows={d.history} />
          </Block>
        </>
      )}
    </div>
  );
}
