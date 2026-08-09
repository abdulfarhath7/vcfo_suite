'use client';

import { Eyebrow, GoldDivider, Surface } from '@/components/noir';
import { Activity } from 'lucide-react';

export function ProjectDetailActivityPanel({
  activity,
}: {
  activity: Array<{ id: string; actor: string; verb: string; target?: string; at: string }>;
}) {
  return (
    <Surface className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-gold" />
        <Eyebrow>Activity</Eyebrow>
      </div>
      <GoldDivider className="mb-3" />
      {activity.length === 0 ? (
        <p className="text-[12px] text-paper-muted">Activity will appear as the team works this project.</p>
      ) : (
        <ul className="space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="text-[12px] leading-relaxed">
              <span className="text-paper">{a.actor}</span>{' '}
              <span className="text-paper-muted">{a.verb}</span>{' '}
              {a.target && <span className="text-brand">{a.target}</span>}
              <div className="text-[10px] mono uppercase tracking-[0.14em] text-paper-subtle mt-0.5">{a.at}</div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
