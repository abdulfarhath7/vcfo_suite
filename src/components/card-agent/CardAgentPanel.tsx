'use client';

import { useEffect, useRef, useState } from 'react';
import { warmLiveBrowser } from '@/hooks/use-live-browser';
import { ArrowLeft, Play, X } from 'lucide-react';

import { useAskOptional } from '@/components/ask/ask-context';
import { Button } from '@/components/ui/button';
import { useCardAgentInfo } from '@/hooks/use-card-agent';
import { beforeFillSummary } from '@/lib/card-agents/before-fill';
import type { CardAgentInfo } from '@/lib/card-agents/card-agents';
import { cn } from '@/lib/utils';
import { ApiFileBody } from './bodies/ApiFileBody';
import { BrowserFillBody } from './bodies/BrowserFillBody';
import { BeforeFill } from './BeforeFill';
import { useCardAgentContext, type CardAgentCard } from './card-agent-context';
import { LevelBadge } from './LevelBadge';
import { LEVEL_LINE } from './level-line';
import { Robot } from './Robot';
import { useBeforeFill } from './use-before-fill';

const GATE_WORD: Record<CardAgentInfo['gates'][number], string> = {
  LOGIN: 'log in',
  CAPTCHA: 'captcha',
  OTP: 'OTP',
  DSC: 'DSC',
  EVC: 'EVC',
  SUBMIT: 'submit',
  PAY: 'pay',
};

const iconButton =
  'inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';

type View = { kind: 'intro' } | { kind: 'before' } | { kind: 'fill'; typeOnPortal: string[] };

/**
 * The card agent panel (MASTER-PLAN screens 3 and 4): the robot, the agent, the client and the
 * level; the task list when a card carries several tasks; one Start. Start opens "Before I fill"
 * for the tasks whose data Suite can check, then "Fill now" hands over to the browser body. An
 * API-route task (GST returns) shows its body at once. A robot that is not built yet says what it
 * will do and offers no Start. The panel sits where the Ask VCFO chat sits; only one is open.
 */
export function CardAgentPanel() {
  const ctx = useCardAgentContext();
  const ask = useAskOptional();
  const card = ctx?.card ?? null;
  const info = useCardAgentInfo(card);
  const open = Boolean(ctx?.open && card && info.data?.agents.length && !ask?.pageOpen);
  if (!open || !ctx || !card || !info.data) return null;
  return <PanelBody card={card} agents={info.data.agents} sections={info.data.sections ?? {}} companyName={info.data.companyName} onClose={() => ctx.setOpen(false)} />;
}

function PanelBody({
  card,
  agents,
  sections,
  companyName,
  onClose,
}: {
  card: CardAgentCard;
  agents: CardAgentInfo[];
  sections: Record<string, string[]>;
  companyName: string;
  onClose: () => void;
}) {
  const [taskId, setTaskId] = useState(agents[0]!.taskId);
  const task = agents.find((a) => a.taskId === taskId) ?? agents[0]!;
  const [view, setView] = useState<View>({ kind: 'intro' });
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  // Keep a server browser warm while the panel is open for a robot that can fill (CARD-AGENTS.md,
  // "one-click start"). Warming never starts a session or opens a portal.
  const canFill = agents.some((a) => a.route === 'browser' && (a.level === 'practice' || a.level === 'ready'));
  useEffect(() => {
    if (canFill) void warmLiveBrowser();
  }, [canFill]);

  const body = (() => {
    if (view.kind === 'before') {
      return (
        <BeforeFill
          engagementId={card.engagementId}
          task={task}
          companyName={companyName}
          sections={sections[task.taskId]}
          onLater={onClose}
          onFillNow={(typeOnPortal) => setView({ kind: 'fill', typeOnPortal })}
        />
      );
    }
    if (view.kind === 'fill') {
      return (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <BrowserFillBody
            engagementId={card.engagementId}
            stepId={card.stepId}
            obligationId={card.obligationId}
            instanceId={card.instanceId}
            task={task}
            onClose={onClose}
            typeOnPortal={view.typeOnPortal}
            companyName={companyName}
          />
        </div>
      );
    }
    return <Intro card={card} agents={agents} task={task} sections={sections[task.taskId]} onPick={setTaskId} onStart={() => setView(task.dataSource ? { kind: 'before' } : { kind: 'fill', typeOnPortal: [] })} companyName={companyName} onClose={onClose} />;
  })();

  return (
    <aside
      id="card-agent-panel"
      ref={ref}
      tabIndex={-1}
      aria-label={task.name}
      className="fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-md border border-line bg-surface-raised shadow-dialog focus:outline-none"
      style={{ width: 'min(440px, calc(100vw - 40px))', maxHeight: 'min(720px, calc(100vh - 40px))' }}
    >
      <div className="flex min-h-[56px] flex-none items-center gap-2.5 border-b border-line-soft px-4 py-2">
        {view.kind !== 'intro' ? (
          <button type="button" className={cn(iconButton, '-ml-2')} aria-label="Back" onClick={() => setView(view.kind === 'fill' && task.dataSource ? { kind: 'before' } : { kind: 'intro' })}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
          </button>
        ) : null}
        <Robot color={task.colour} mood={view.kind === 'fill' ? 'working' : task.level === 'coming' ? 'blocked' : 'idle'} size={34} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-medium text-ink">{task.name}</h2>
          <p className="truncate text-[12.5px] text-ink-muted">
            {companyName} · {task.form}
            {view.kind === 'before' ? ' · Before I fill' : ''}
          </p>
        </div>
        <LevelBadge level={task.level} />
        <button type="button" onClick={onClose} aria-label={`Close ${task.name}`} className={iconButton}>
          <X className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>
      {body}
    </aside>
  );
}

function Intro({
  card,
  agents,
  task,
  sections,
  onPick,
  onStart,
  companyName,
  onClose,
}: {
  card: CardAgentCard;
  agents: CardAgentInfo[];
  task: CardAgentInfo;
  sections?: string[];
  onPick: (taskId: string) => void;
  onStart: () => void;
  companyName: string;
  onClose: () => void;
}) {
  const api = task.dataSource === 'gst-return' || task.route === 'api';
  const checks = Boolean(task.dataSource) && !api;
  const coming = task.level === 'coming' && !task.dataSource;
  const data = useBeforeFill(card.engagementId, task.taskId, checks ? task.dataSource : null, checks, sections);
  const summary = data.items ? beforeFillSummary(data.items) : null;
  const yours = task.gates.map((g) => GATE_WORD[g]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {agents.length > 1 ? (
        <fieldset className="mb-3">
          <legend className="mb-1 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">Tasks on this card</legend>
          <div className="grid gap-1">
            {agents.map((a) => (
              <label
                key={a.taskId}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border-1.5 px-2.5 py-1.5 text-[13px]',
                  a.taskId === task.taskId ? 'border-brand-line bg-brand-soft/50' : 'border-line hover:bg-hover',
                )}
              >
                <input type="radio" name="card-agent-task" className="sr-only" checked={a.taskId === task.taskId} onChange={() => onPick(a.taskId)} />
                <Robot color={a.colour} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{a.name}</span>
                  <span className="block truncate text-[12px] text-ink-muted">{a.form}</span>
                </span>
                <LevelBadge level={a.level} />
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-2 text-[13px]">
        <p className="text-ink-2">
          <span className="font-medium text-ink">Level: {task.levelLabel}.</span> {LEVEL_LINE[task.level]}
        </p>
        {task.note ? <p className="text-ink-muted">{task.note}</p> : null}

        {api ? (
          <ApiFileBody engagementId={card.engagementId} stepId={card.stepId} obligationId={card.obligationId} instanceId={card.instanceId} task={task} onClose={onClose} companyName={companyName} />
        ) : coming ? (
          <div role="status" className="rounded-md border-1.5 border-line bg-surface-sunken/60 px-3 py-2.5">
            <p className="font-medium text-ink">What I will do</p>
            <p className="mt-0.5 text-ink-2">
              When my recipe is built, I will fill {task.form} on {task.portalHost ?? 'the portal'} from what Suite holds for {companyName}.
              {yours.length ? ` You still ${listWords(yours)}.` : ''}
            </p>
            <p className="mt-1.5 text-ink-muted">Today: not built yet, so there is nothing to start. Fill the form on the portal as usual.</p>
          </div>
        ) : (
          <>
            {checks ? (
              <p className={cn('text-[13px]', summary?.requiredMissing ? 'text-warning' : 'text-ink-2')} aria-live="polite">
                {summary
                  ? summary.requiredMissing
                    ? `${summary.requiredMissing} required ${summary.requiredMissing === 1 ? 'item is' : 'items are'} missing · data ${summary.pct}% ready`
                    : `Every required item is in Suite · data ${summary.pct}% ready`
                  : data.error
                    ? 'The data check could not load.'
                    : 'Checking the data…'}
              </p>
            ) : null}
            {yours.length ? <p className="text-ink-muted">You do: {listWords(yours)}. I never type a login, captcha or OTP, and I never sign, submit or pay.</p> : null}
            <div className="mt-2 flex justify-center">
              <Button onClick={onStart}>
                <Play aria-hidden />
                Start
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
