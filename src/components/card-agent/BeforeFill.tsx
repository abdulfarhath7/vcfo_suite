'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Check, ChevronDown, CircleHelp, ExternalLink, FileSearch, Minus, Send, X } from 'lucide-react';

import { useAskOptional } from '@/components/ask/ask-context';
import { ConfirmClientValues } from '@/components/assist-profile/ConfirmClientValues';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { useGstSourcing } from '@/hooks/use-gst-registration';
import {
  beforeFillSummary,
  choiceLabel,
  choicesFor,
  clientRequestItems,
  fillNowState,
  groupBeforeFill,
  itemsChosen,
  type BeforeFillItem,
} from '@/lib/card-agents/before-fill';
import type { CardAgentInfo } from '@/lib/card-agents/card-agents';
import { apiFetch } from '@/lib/projects/engagements-db';
import { requestsPageHref } from '@/lib/request-lists/model';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { useBeforeFill } from './use-before-fill';

const SOURCE_WORD: Record<string, string> = {
  tool: 'Suite',
  sharepoint: 'SharePoint',
  zoho: 'Zoho',
  client: 'the client',
  portal: 'the portal',
};

const READY_SHOWN = 5;

/**
 * "BEFORE I FILL" (MASTER-PLAN screen 4): what the form needs, what Suite has and what is missing,
 * and one choice per missing item. "Fill now" unlocks only when every required item is present or
 * set to "I type on the portal"; nothing is filled before it. The choices are kept per engagement
 * and task, and the list reads itself again while it waits for data.
 */
export function BeforeFill({
  engagementId,
  task,
  companyName,
  onFillNow,
  onLater,
  sections,
}: {
  engagementId: string;
  task: CardAgentInfo;
  companyName: string;
  /** The Assist profile sections the task's recipe fills. */
  sections?: string[];
  /** "Fill now", with the keys the person types on the portal. */
  onFillNow: (typeOnPortal: string[]) => void;
  /** "Save and come back". */
  onLater: () => void;
}) {
  const data = useBeforeFill(engagementId, task.taskId, task.dataSource, true, sections);
  const { user } = useApp();
  const ask = useAskOptional();
  const sourcing = useGstSourcing(engagementId);
  const [showReady, setShowReady] = useState(false);
  const [listHref, setListHref] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const draftList = useMutation({
    mutationFn: (items: ReturnType<typeof clientRequestItems>) =>
      apiFetch<{ list: { id: string } }>('/api/request-lists', {
        method: 'POST',
        body: JSON.stringify({ engagementId, title: `${task.form} details`, cadenceDays: 3, items }),
        fallbackError: 'Could not draft the request list.',
      }),
  });

  if (data.loading) {
    return (
      <p className="px-4 py-6 text-[13px] text-ink-muted" aria-busy>
        Checking what Suite holds for {task.form}…
      </p>
    );
  }
  if (data.error || !data.items) {
    return (
      <div className="grid gap-2 px-4 py-6 text-[13px]">
        <p className="text-ink-muted">{errorMessage(data.error, `The data for ${task.form} could not be loaded.`)}</p>
        <div>
          <Button size="sm" variant="outline" onClick={() => void data.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const items = data.items;
  const groups = groupBeforeFill(items);
  const summary = beforeFillSummary(items);
  const fill = fillNowState(items, data.choices);
  const fromSharepoint = itemsChosen(items, data.choices, 'sharepoint');
  const fromClient = clientRequestItems(items, data.choices, task.form);
  const fromZoho = itemsChosen(items, data.choices, 'zoho');
  const ready = showReady ? groups.ready : groups.ready.slice(0, READY_SHOWN);

  const readSharepoint = async () => {
    try {
      const out = await sourcing.mutateAsync('fetch_sharepoint');
      setStatus(out.message);
      toastSuccess('Reading SharePoint', out.message);
    } catch (e) {
      toastError('Could not read SharePoint', errorMessage(e));
    }
  };
  const askClient = async () => {
    try {
      const out = await draftList.mutateAsync(fromClient);
      const href = `${requestsPageHref(user?.role ?? '')}?list=${encodeURIComponent(out.list.id)}`;
      setListHref(href);
      setStatus(`Drafted a request list with ${fromClient.length} item${fromClient.length === 1 ? '' : 's'}. Nothing reaches ${companyName} until you send it.`);
      toastSuccess('Request list drafted', 'Review it and send it from Requests.');
    } catch (e) {
      toastError('Could not draft the request list', errorMessage(e));
    }
  };
  const askZoho = () => {
    // Ask VCFO reads Zoho; its chat takes the corner, so this panel closes and keeps the choices.
    data.save();
    ask?.setOpen(true);
    void ask?.ask({ message: `Read these for ${companyName} from Zoho for ${task.form}: ${fromZoho.map((i) => i.label).join(', ')}.` });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none border-b border-line-soft px-4 py-2.5" aria-label="What the form needs">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
          <span>
            Needs <b className="font-medium tabular-nums text-ink">{summary.values.need}</b> values + <b className="font-medium tabular-nums text-ink">{summary.documents.need}</b> docs
          </span>
          <span>
            Have <b className="font-medium tabular-nums text-ink">{summary.values.have}</b> + <b className="font-medium tabular-nums text-ink">{summary.documents.have}</b>
          </span>
          <span>
            Missing <b className={cn('font-medium tabular-nums', summary.requiredMissing ? 'text-warning' : 'text-ink')}>{summary.values.missing}</b> +{' '}
            <b className={cn('font-medium tabular-nums', summary.requiredMissing ? 'text-warning' : 'text-ink')}>{summary.documents.missing}</b>
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="relative block h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-label="Data ready"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.pct}
          >
            <i className="absolute inset-y-0 left-0 rounded-full bg-positive-mid" style={{ width: `${summary.pct}%` }} />
          </span>
          <span className="text-[12px] tabular-nums text-ink-muted">{summary.pct}%</span>
          {data.refreshing ? <span className="text-[11.5px] text-ink-faint">checking…</span> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <Group title="Ready" count={groups.ready.length}>
          {ready.map((item) => (
            <Row key={item.key} item={item} mark="ok">
              <span className="min-w-0 truncate text-ink-2" title={item.value}>
                {item.value}
              </span>
              <span className="flex-none text-[11.5px] text-ink-faint">from {SOURCE_WORD[item.source] ?? item.source}</span>
            </Row>
          ))}
          {groups.ready.length > READY_SHOWN ? (
            <button
              type="button"
              aria-expanded={showReady}
              onClick={() => setShowReady((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-text hover:underline"
            >
              {showReady ? 'Show fewer' : `Show all ${groups.ready.length}`}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showReady && 'rotate-180')} aria-hidden />
            </button>
          ) : null}
        </Group>

        {groups.confirm.length ? (
          <Group title="Needs your confirmation" count={groups.confirm.length}>
            {data.gst ? (
              <ConfirmClientValues engagementId={engagementId} items={data.gst.view.confirm ?? []} />
            ) : (
              groups.confirm.map((item) => <Row key={item.key} item={item} mark="ask" />)
            )}
          </Group>
        ) : null}

        <Group title="Missing, required" count={groups.missingRequired.length} empty="Nothing required is missing.">
          {groups.missingRequired.map((item) => (
            <MissingRow key={item.key} item={item} engagementId={engagementId} data={data} />
          ))}
        </Group>

        {groups.missingOptional.length ? (
          <Group title="Missing, optional" count={groups.missingOptional.length}>
            {groups.missingOptional.map((item) => (
              <MissingRow key={item.key} item={item} engagementId={engagementId} data={data} />
            ))}
          </Group>
        ) : null}

        {fromSharepoint.length || fromClient.length || fromZoho.length ? (
          <div className="mt-3 grid gap-2 rounded-md border-1.5 border-line bg-surface-sunken/60 p-3" aria-label="Get the missing items">
            <p className="text-[12px] font-medium text-ink">Get the missing items</p>
            <div className="flex flex-wrap gap-2">
              {fromSharepoint.length ? (
                <Button size="sm" variant="outline" disabled={sourcing.isPending} onClick={() => void readSharepoint()}>
                  <FileSearch aria-hidden />
                  Read {fromSharepoint.length} from SharePoint
                </Button>
              ) : null}
              {fromClient.length ? (
                <Button size="sm" variant="outline" disabled={draftList.isPending || Boolean(listHref)} onClick={() => void askClient()}>
                  <Send aria-hidden />
                  Draft request list ({fromClient.length})
                </Button>
              ) : null}
              {fromZoho.length && ask?.enabled ? (
                <Button size="sm" variant="outline" onClick={askZoho}>
                  Get {fromZoho.length} from Zoho
                </Button>
              ) : null}
            </div>
            {status ? (
              <p role="status" className="text-[12.5px] text-ink-2">
                {status}
              </p>
            ) : null}
            {listHref ? (
              <Link href={listHref} className="text-[12.5px] font-medium text-brand-text hover:underline">
                Open the request list
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-none flex-wrap items-center gap-2 border-t border-line-soft px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            data.save();
            toastSuccess('Saved', `Your choices for ${companyName} are kept on this computer. The list updates as the data arrives.`);
            onLater();
          }}
        >
          Save and come back
        </Button>
        <span className="min-w-0 flex-1 text-right text-[12px] text-ink-muted">
          {fill.unlocked ? (fill.typeOnPortal.length ? `You type ${fill.typeOnPortal.length} on the portal` : 'Everything is ready') : `${fill.blocking.length} required still open`}
        </span>
        <Button size="sm" disabled={!fill.unlocked} onClick={() => onFillNow(fill.typeOnPortal)} aria-describedby={fill.unlocked ? undefined : 'ca-fill-locked'}>
          Fill now
        </Button>
        {fill.unlocked ? null : (
          <p id="ca-fill-locked" className="sr-only">
            Fill now unlocks when every required item is in Suite or set to I type on the portal.
          </p>
        )}
      </div>
    </div>
  );
}

function Group({ title, count, empty, children }: { title: string; count: number; empty?: string; children?: React.ReactNode }) {
  return (
    <section className="mb-3" aria-label={title}>
      <h3 className="mb-1 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
        {title} ({count})
      </h3>
      {count === 0 && empty ? <p className="text-[12.5px] text-ink-muted">{empty}</p> : <ul className="grid gap-1">{children}</ul>}
    </section>
  );
}

const MARK = {
  ok: { Icon: Check, cls: 'text-positive', word: 'Ready' },
  ask: { Icon: CircleHelp, cls: 'text-info', word: 'Needs confirmation' },
  bad: { Icon: X, cls: 'text-danger', word: 'Missing' },
  opt: { Icon: Minus, cls: 'text-ink-faint', word: 'Missing, optional' },
} as const;

function Row({ item, mark, children }: { item: BeforeFillItem; mark: keyof typeof MARK; children?: React.ReactNode }) {
  const m = MARK[mark];
  return (
    <li className="flex min-w-0 items-baseline gap-2 text-[13px]">
      <m.Icon className={cn('h-3.5 w-3.5 flex-none translate-y-[2px]', m.cls)} aria-label={m.word} />
      <span className="flex-none text-ink">{item.label}</span>
      {item.kind === 'document' ? <span className="flex-none text-[11px] text-ink-faint">document</span> : null}
      {children}
    </li>
  );
}

function MissingRow({ item, engagementId, data }: { item: BeforeFillItem; engagementId: string; data: ReturnType<typeof useBeforeFill> }) {
  const allowed = choicesFor(item, data.ctx);
  const choice = data.choices[item.key];
  const id = `ca-choice-${item.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const stepHref = item.stepId ? `/api/assist/step-link/${encodeURIComponent(engagementId)}?step=${encodeURIComponent(item.stepId)}` : null;
  return (
    <li className="grid gap-1 rounded-md border border-line-soft px-2.5 py-2 text-[13px]">
      <div className="flex min-w-0 items-baseline gap-2">
        {item.required ? <X className="h-3.5 w-3.5 flex-none translate-y-[2px] text-danger" aria-label="Missing" /> : <Minus className="h-3.5 w-3.5 flex-none translate-y-[2px] text-ink-faint" aria-label="Missing, optional" />}
        <label htmlFor={id} className="min-w-0 flex-1 text-ink">
          {item.label}
          {item.kind === 'document' ? <span className="ml-1.5 text-[11px] text-ink-faint">document</span> : null}
        </label>
        <select
          id={id}
          value={choice ?? ''}
          onChange={(e) => data.choose(item.key, e.target.value as (typeof allowed)[number])}
          className="h-control-sm max-w-[190px] flex-none rounded-md border-1.5 border-line-strong bg-surface-raised px-2 text-[12.5px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {allowed.map((c) => (
            <option key={c} value={c}>
              {choiceLabel(c, item.kind)}
            </option>
          ))}
        </select>
      </div>
      {item.where || (choice === 'type-now' && stepHref) ? (
        <div className="flex flex-wrap items-center gap-x-3 pl-[22px] text-[12px] text-ink-muted">
          {item.where ? <span>{item.where}</span> : null}
          {choice === 'type-now' && stepHref ? (
            <a href={stepHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-text hover:underline">
              Open the field
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
