"use client";

import { m } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Engagement, TaskInstance } from '@/data/engagements';
import { StatusDot } from '@/components/noir/StatusDot';
import { Eyebrow } from '@/components/noir/Eyebrow';
import { NoirCard } from '@/components/noir/NoirCard';
import { adminProjectPath } from '@/lib/project-step-path';

interface Props {
  engagements: Engagement[];
  tasks: TaskInstance[];
}

export function NeedsAttentionRail({ engagements, tasks }: Props) {
  const router = useRouter();
  const tasksByEngagement = new Map<string, TaskInstance[]>();
  for (const t of tasks) {
    const list = tasksByEngagement.get(t.engagementId);
    if (list) list.push(t);
    else tasksByEngagement.set(t.engagementId, [t]);
  }

  const flagged: Array<{ e: Engagement; stuck: number }> = [];
  for (const e of engagements) {
    const eTasks = tasksByEngagement.get(e.id) ?? [];
    let stuck = 0;
    for (const t of eTasks) {
      if (t.status === 'awaiting-client' || t.status === 'overdue') stuck += 1;
    }
    if (e.health !== 'on-track' || stuck > 0) {
      flagged.push({ e, stuck });
    }
  }

  flagged.sort((a, b) => {
    const score = (x: Engagement) =>
      x.health === 'overdue' ? 2 : x.health === 'at-risk' ? 1 : 0;
    return score(b.e) - score(a.e) || b.stuck - a.stuck;
  });

  return (
    <NoirCard flat className="p-4 shadow-layered">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-gold" />
          <Eyebrow>Needs attention now</Eyebrow>
        </div>
        <span className="mono text-[10.5px] text-paper-muted">{flagged.length}</span>
      </div>

      {flagged.length === 0 ? (
        <div className="py-8 text-center">
          <div className="serif text-[18px] text-paper-muted italic">Portfolio on track.</div>
          <div className="mono text-[10.5px] text-subtle-paper uppercase tracking-[0.18em] mt-1.5">
            Nothing flagged
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {flagged.map(({ e, stuck }, i) => (
            <m.button
              key={e.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.22 }}
              onClick={() => router.push(adminProjectPath(e))}
              className="w-full flex items-center gap-3 p-2.5 rounded-md border border-transparent hover:border-hairline hover:bg-raised/40 transition-colors text-left group"
            >
              <StatusDot
                tone={e.health === 'overdue' ? 'danger' : 'warning'}
                pulse={e.health === 'overdue'}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-paper truncate">{e.companyName}</div>
                <div className="mono text-[10.5px] text-paper-muted uppercase tracking-wider mt-0.5">
                  {e.stage}
                  {stuck > 0
                    ? ` · ${stuck} step${stuck === 1 ? '' : 's'} blocked`
                    : e.health !== 'on-track'
                      ? ' · at risk'
                      : ''}
                </div>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-paper-muted group-hover:text-brand transition-colors" />
            </m.button>
          ))}
        </div>
      )}
    </NoirCard>
  );
}
