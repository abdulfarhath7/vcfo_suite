'use client';

/**
 * Ask VCFO inside the console chat — the staff answer card of the live panel
 * (AskAnswerCard, staff rows) in the prototype's `.mx-card` form: trust badge,
 * depth, the answer, its visual, sources, go-there links, Simpler / More
 * detail, Open in Projects, Draft reminder (opens Email with the subject and
 * body filled in, never sends), and related questions. Also the super admin's
 * "Preview as a client" picker.
 */
import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import type { AnswerEnvelope, Visual } from '@/data/ask/schema';
import { visualSchema } from '@/data/ask/schema';
import { useAskOptional } from '@/components/ask/ask-context';
import { visualText } from '@/components/ask/visuals/visual-text';
import { getTopic } from '@/lib/ask/topics';
import { resolveHref } from '@/lib/ask/resolve-href';
import { reminderComposeHref } from '@/lib/ask/reminder';
import { adminProjectPath } from '@/lib/project-step-path';
import type { StaffBasePath } from '@/lib/auth-routes';
import { Icon } from '../../ui';

function Trust({ answer, firmName }: { answer: AnswerEnvelope; firmName: string }) {
  if (answer.origin === 'refusal') return null;
  if (answer.draft)
    return (
      <span className="pill mut" title="Served from a topic that is not reviewed yet">
        Not yet reviewed · check with your lead
      </span>
    );
  if (answer.origin === 'reviewed' || answer.origin === 'deterministic')
    return (
      <span className="pill ok" title="Reviewed content, or read straight from your data">
        <Icon name="check" />
        Reviewed by {firmName}
      </span>
    );
  return (
    <span className="pill mut" title="Written by the assistant from your data and the sources below">
      AI answer · check with your lead
    </span>
  );
}

function AskVisual({ visual, openProject }: { visual: Visual; openProject: (engagementId: string) => void }) {
  const sr = <span className="sr-only">{visualText(visual)}</span>;
  switch (visual.type) {
    case 'projectRows':
      return visual.rows.length ? (
        <div className="upd-av">
          {visual.rows.map((r, i) => (
            <button key={`${r.engagementId}-${i}`} type="button" className="mx-drow" onClick={() => openProject(r.engagementId)}>
              <span className="mx-dt">
                <b className="upd-ell" title={r.name}>
                  {r.name}
                </b>
                <span className="upd-ell" title={r.step}>
                  {r.step}
                </span>
              </span>
              <span className={'pill ' + (r.tone === 'late' ? 'over' : r.tone === 'waiting' ? 'due' : 'mut')}>{r.meta}</span>
              <Icon name="chev" size={14} />
            </button>
          ))}
        </div>
      ) : null;
    case 'metrics':
      return (
        <dl className="upd-am">
          {sr}
          {visual.items.map((m) => (
            <div key={m.k} aria-hidden="true">
              <dt>{m.k}</dt>
              <dd>{m.v}</dd>
            </div>
          ))}
        </dl>
      );
    case 'keyFacts':
      return (
        <dl className="upd-akf">
          {visual.facts.map((f) => (
            <div key={f.k}>
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      );
    case 'flow':
      return (
        <ol className="upd-aflow">
          {visual.stages.map((s, i) => (
            <li key={`${s.label}-${i}`} className={'st-' + s.state}>
              <span className="eyebrow">{s.state === 'done' ? 'Done' : s.state === 'here' ? 'You are here' : 'Next'}</span>
              <b>{s.label}</b>
              {s.sub ? <span className="small">{s.sub}</span> : null}
            </li>
          ))}
        </ol>
      );
    case 'steps':
      return (
        <ol className="upd-asteps">
          {visual.items.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              {s.label}
              {s.form ? <span className="mx-code"> {s.form}</span> : null}
            </li>
          ))}
        </ol>
      );
    case 'compare':
      return (
        <div className="upd-acmp">
          {[visual.left, visual.right].map((side) => (
            <div key={side.title}>
              <b>{side.title}</b>
              <ul>
                {side.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'timeline':
      return (
        <ol className="upd-asteps">
          {visual.events.map((e, i) => (
            <li key={`${e.label}-${i}`}>
              {e.label} <span className="small">· {e.when}</span>
            </li>
          ))}
        </ol>
      );
    case 'nextStep':
      return (
        <div className="upd-anext">
          <b>{visual.title}</b>
          {visual.dueLabel ? <span className="pill due">{visual.dueLabel}</span> : null}
          {visual.items.length ? (
            <ul>
              {visual.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

export function AnswerCard({ answer, staffBase, nav }: { answer: AnswerEnvelope; staffBase: StaffBasePath; nav: (href: string) => void }) {
  const ask = useAskOptional();
  if (!ask) return null;
  const has = (a: AnswerEnvelope['actions'][number]) => answer.actions.includes(a);
  const hasLinks = Boolean(answer.links?.length);
  const rowTarget = answer.target?.engagementId;
  const parsed = answer.visual ? visualSchema.safeParse(answer.visual) : null;
  const projectHref = (id: string) => adminProjectPath({ slug: id, id }, staffBase);
  const changeDepth = (depth: 'simple' | 'detail') => {
    if (answer.topicSlug) void ask.showTopic(answer.topicSlug, depth, depth === 'simple' ? 'Simpler, please' : 'More detail, please');
    else void ask.ask({ message: depth === 'simple' ? 'Explain that more simply.' : 'Tell me more detail.', depth });
  };
  const related = (answer.related ?? []).slice(0, 2).map((slug) => ({ slug, topic: getTopic(slug) })).filter((r) => r.topic);

  return (
    <div className="mx-card">
      <div className="mx-chips">
        <span className="eyebrow">Answer</span>
        <Trust answer={answer} firmName={ask.firmName} />
        {answer.depth !== 'normal' ? <span className="pill mut">{answer.depth === 'simple' ? 'Simpler' : 'More detail'}</span> : null}
      </div>
      {answer.title && answer.title !== answer.line ? <b>{answer.title}</b> : null}
      <p>{answer.line}</p>
      {parsed?.success ? <AskVisual visual={parsed.data} openProject={(id) => nav(projectHref(id))} /> : null}
      {answer.citations.length ? (
        <div className="mx-src">
          <Icon name="doc" />
          <span>
            Source:{' '}
            {answer.citations.map((c, i) => (
              <span key={c.id}>
                {i > 0 ? ' · ' : ''}
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="upd-srcl">
                    {c.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  c.label
                )}
              </span>
            ))}
          </span>
        </div>
      ) : null}
      <div className="mx-chips">
        {(answer.links ?? []).map((l, i) => (
          <button key={`${l.dest.to}-${i}`} type="button" className={'btn sm' + (l.primary ? ' pri' : '')} onClick={() => nav(resolveHref(l.dest, staffBase))}>
            {l.label}
            <Icon name="chev" />
          </button>
        ))}
        {has('openProject') && !hasLinks && rowTarget ? (
          <button type="button" className="btn sm" onClick={() => nav(projectHref(rowTarget))}>
            Open in Projects
          </button>
        ) : null}
        {has('draftReminder') ? (
          <button type="button" className="btn sm" title="Opens Email with a draft; nothing is sent" onClick={() => nav(reminderComposeHref(staffBase, answer))}>
            <Icon name="mail" />
            Draft reminder
          </button>
        ) : null}
        {has('simpler') ? (
          <button type="button" className="btn sm" disabled={ask.busy} onClick={() => changeDepth('simple')}>
            Simpler
          </button>
        ) : null}
        {has('detail') ? (
          <button type="button" className="btn sm" disabled={ask.busy} onClick={() => changeDepth('detail')}>
            More detail
          </button>
        ) : null}
      </div>
      {related.length ? (
        <div className="ch-chips upd-rel">
          {related.map((r) => (
            <button key={r.slug} type="button" disabled={ask.busy} onClick={() => void ask.showTopic(r.slug, undefined, r.topic!.question)}>
              {r.topic!.question}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Super admin: "Preview Ask VCFO as a client" — pick one engagement (live AskPreviewPicker). */
export function PreviewPicker() {
  const ask = useAskOptional();
  const { engagements } = useApp();
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return engagements
      .filter((e) => e.stage !== 'Operational Readiness')
      .filter((e) => !t || e.companyName.toLowerCase().includes(t))
      .slice(0, 8);
  }, [engagements, q]);
  if (!ask || ask.shell !== 'super') return null;
  return (
    <div className="mx-card">
      <input className="mx-in" type="search" placeholder="Find a client" aria-label="Find a client" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length ? (
        matches.map((e) => (
          <button key={e.id} type="button" className="mx-drow" onClick={() => ask.setPreview({ engagementId: e.id, companyName: e.companyName })}>
            <span className="mx-dt">
              <b className="upd-ell">{e.companyName}</b>
            </span>
          </button>
        ))
      ) : (
        <span className="small">No matching clients.</span>
      )}
    </div>
  );
}
