import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { Surface } from '@/components/noir';
import {
  groupedVcfoPortalTasks,
  type VcfoPortalGroup,
  type VcfoPortalHead,
  type VcfoPortalTask,
} from '@/lib/announcement-portals';
import { cn } from '@/lib/utils';

const RECURRING_HEADS = new Set<VcfoPortalHead>([
  'Monthly Compliances',
  'Quarterly Compliances',
  'Half-yearly Compliances',
  'Yearly Compliances',
]);

const OPEN_BY_DEFAULT = new Set<VcfoPortalHead>([
  'Incorporation',
  'Registrations',
  'Monthly Compliances',
]);

function ExternalHref({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
    >
      {children}
      <ArrowUpRight className="h-3 w-3" aria-hidden />
    </a>
  );
}

function TaskRow({ task }: { task: VcfoPortalTask }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0 text-[13px] leading-snug text-ink">{task.task}</span>
      <span className="flex shrink-0 items-center gap-2.5">
        {task.portalUrl ? <ExternalHref href={task.portalUrl}>Portal</ExternalHref> : null}
        {task.circularUrl ? <ExternalHref href={task.circularUrl}>Circular</ExternalHref> : null}
      </span>
    </li>
  );
}

function GroupCard({ group, defaultOpen }: { group: VcfoPortalGroup; defaultOpen: boolean }) {
  return (
    <details
      open={defaultOpen}
      className="rounded-card border border-border/80 bg-raised/40 px-3.5 py-1 open:[&_summary_svg]:rotate-180"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 text-[12.5px] font-semibold tracking-tight text-ink">{group.head}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <span className="tabular-nums text-[11px]">{group.tasks.length}</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform" aria-hidden />
        </span>
      </summary>
      <ul className="mb-1.5 divide-y divide-border/70 border-t border-border/70">
        {group.tasks.map((task) => (
          <TaskRow key={`${group.head}:${task.task}`} task={task} />
        ))}
      </ul>
    </details>
  );
}

function Band({
  label,
  groups,
  columns,
}: {
  label: string;
  groups: VcfoPortalGroup[];
  columns?: boolean;
}) {
  if (groups.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">
        {label}
      </h3>
      <div className={cn(columns ? 'grid gap-2.5 sm:grid-cols-2' : 'grid gap-2.5')}>
        {groups.map((group) => (
          <GroupCard key={group.head} group={group} defaultOpen={OPEN_BY_DEFAULT.has(group.head)} />
        ))}
      </div>
    </section>
  );
}

export function OfficialPortalsDirectory({ compact }: { compact?: boolean }) {
  const groups = groupedVcfoPortalTasks();
  const setup = groups.filter((group) => !RECURRING_HEADS.has(group.head));
  const recurring = groups.filter((group) => RECURRING_HEADS.has(group.head));

  if (compact) {
    return (
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.head}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">
              {group.head}
            </h3>
            <ul className="mt-1 divide-y divide-border/70">
              {group.tasks.map((task) => (
                <TaskRow key={`${group.head}:${task.task}`} task={task} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <Surface id="official-portals" flat className="p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">Official portals & circulars</h2>
        </div>
      </div>
      <div className="mt-4 space-y-5">
        <Band label="Setup & filings" groups={setup} columns />
        <Band label="Recurring" groups={recurring} columns />
      </div>
    </Surface>
  );
}
