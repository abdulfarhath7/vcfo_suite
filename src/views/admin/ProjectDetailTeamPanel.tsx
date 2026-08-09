'use client';

import { Eyebrow, GoldDivider, Surface } from '@/components/noir';
import { Users } from 'lucide-react';

export function ProjectDetailTeamPanel({
  intern,
  leads,
}: {
  intern?: { id: string; name: string };
  leads?: Array<{ id: string; name: string }>;
}) {
  const members: Array<{ id: string; name: string }> = [];
  for (const lead of leads ?? []) {
    if (!members.some((m) => m.id === lead.id)) members.push(lead);
  }
  if (intern && !members.some((m) => m.id === intern.id)) {
    members.unshift(intern);
  }

  return (
    <Surface className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-3.5 h-3.5 text-gold" />
        <Eyebrow>Team</Eyebrow>
      </div>
      <GoldDivider className="mb-3" />
      {members.length === 0 ? (
        <p className="text-[12px] text-paper-subtle">No leads assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-hairline-strong bg-raised flex items-center justify-center text-[11px] mono text-gold">
                {m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-paper truncate">{m.name}</div>
                <div className="text-[10.5px] mono uppercase tracking-[0.14em] text-paper-subtle">
                  {i === 0 ? 'Delivery owner' : 'Lead'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}
