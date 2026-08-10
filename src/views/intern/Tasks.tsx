"use client";

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { StatusPill } from '@/components/common/StatusPill';
import { Surface, EmptyStateIllustrated } from '@/components/noir';
import { checklist, StatusCode, STATUS_LABEL } from '@/data/checklist';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { m, AnimatePresence } from 'framer-motion';
import { Search, LayoutGrid, List as ListIcon, ListChecks, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUSES: StatusCode[] = ['not-started', 'in-progress', 'awaiting-client', 'completed'];

export default function InternTasks() {
  const { tasks, engagements, updateTask } = useApp();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [q, setQ] = useState('');

  const checklistById = new Map(checklist.map((c) => [c.id, c]));
  const engagementById = new Map(engagements.map((e) => [e.id, e]));
  const qLower = q.toLowerCase();
  const enriched = [];
  for (const t of tasks) {
    const def = checklistById.get(t.checklistKey);
    const eng = engagementById.get(t.engagementId);
    const defTitle = def?.title.toLowerCase() ?? '';
    const companyName = eng?.companyName.toLowerCase() ?? '';
    const haystack = `${defTitle} ${companyName}`;
    if (!qLower || haystack.includes(qLower)) {
      enriched.push({ t, def, eng });
    }
  }

  return (
    <PageTransition>
      <SEO title="Tasks — VCFO Suite" description="Work through checklist items across your engagements—list or board view." path="/app/intern/tasks" />

      <PageHeader
        accent="emerald"
        icon={ListTodo}
        eyebrow="Work queue"
        title="Tasks"
        subtitle={`${enriched.length} tasks across ${engagements.length} engagements`}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {(['list', 'kanban'] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setView(v)}
                aria-label={v === 'list' ? 'List view' : 'Board view'}
                aria-pressed={view === v}
                className={cn(
                  'flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[12px] sm:min-h-9',
                  view === v ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'list' ? <ListIcon className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                {v === 'list' ? 'List' : 'Board'}
              </button>
            ))}
          </div>
        }
      />

      <Surface flat className="mb-3 flex min-h-11 items-center gap-2 px-3 py-2">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by task or company..." aria-label="Search by task or company" className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-muted-foreground min-h-11" />
      </Surface>

      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <m.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="surface overflow-hidden">
            {enriched.length === 0 ? (
              <div className="p-6">
                <EmptyStateIllustrated
                  icon={ListChecks}
                  title={q ? 'No matching tasks' : 'No tasks yet'}
                  description={
                    q
                      ? 'Try a different search, or clear the filter to see your full queue.'
                      : 'Checklist items across your engagements will show up here.'
                  }
                  actionLabel={q ? 'Clear search' : undefined}
                  onAction={q ? () => setQ('') : undefined}
                  className="border-0 bg-transparent py-8 shadow-none"
                />
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-2 p-3 md:hidden">
                  {enriched.map(({ t, def, eng }, i) => (
                    <m.div
                      key={t.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(0.2, 0.015 * i) }}
                      className="rounded-xl border border-border/80 bg-card px-3.5 py-3"
                    >
                      <div className="text-[13px] font-medium text-ink">{def?.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-text-tertiary">
                        <span className="truncate">{eng?.companyName}</span>
                        {def?.bucket ? <span>· {def.bucket}</span> : null}
                      </div>
                      <div className="mt-2.5">
                        <Select value={t.status} onValueChange={(v) => updateTask(t.id, { status: v as StatusCode })}>
                          <SelectTrigger className="h-9 min-h-9 text-[12px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s} className="text-[12px]">{STATUS_LABEL[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </m.div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <div className="grid grid-cols-[1fr_180px_140px_160px] gap-4 border-b border-border bg-table-header px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <div>Task</div><div>Engagement</div><div>Bucket</div><div>Status</div>
                  </div>
                  {enriched.map(({ t, def, eng }, i) => (
                    <m.div
                      key={t.id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(0.2, 0.015 * i) }}
                      className="grid grid-cols-[1fr_180px_140px_160px] items-center gap-4 border-b border-border px-4 py-3 last:border-0 hover:bg-raised/40 min-h-11"
                    >
                      <div className="text-[13px] text-ink truncate">{def?.title}</div>
                      <div className="text-[12px] text-text-secondary truncate">{eng?.companyName}</div>
                      <div className="text-[11.5px] text-text-tertiary">{def?.bucket}</div>
                      <Select value={t.status} onValueChange={(v) => updateTask(t.id, { status: v as StatusCode })}>
                        <SelectTrigger className="h-7 text-[11.5px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s} className="text-[12px]">{STATUS_LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </m.div>
                  ))}
                </div>
              </>
            )}
          </m.div>
        ) : (
          <m.div key="kan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUSES.map((s) => {
              const col = enriched.filter(({ t }) => t.status === s);
              return (
                <div key={s} className="surface flex flex-col min-h-[220px] lg:min-h-[300px]">
                  <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                    <StatusPill status={s} />
                    <span className="text-[11px] text-text-tertiary tabular-nums">{col.length}</span>
                  </div>
                  <div className="p-2 space-y-1.5 flex-1">
                    {col.length === 0 ? (
                      <p className="px-1 py-6 text-center text-[11.5px] italic text-text-tertiary">No tasks</p>
                    ) : (
                      col.map(({ t, def, eng }) => (
                        <m.div
                          layout
                          key={t.id}
                          className="p-2.5 rounded-md bg-muted/40 hover:bg-muted border border-transparent hover:border-border cursor-pointer"
                        >
                          <div className="text-[12.5px] text-ink leading-tight">{def?.title}</div>
                          <div className="text-[10.5px] text-text-tertiary mt-1">{eng?.companyName}</div>
                        </m.div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
