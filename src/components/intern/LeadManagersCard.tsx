'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Mail, Users } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import {
  internManagerComposeHref,
  resolveLeadManagers,
  type LeadManagerEngagement,
} from '@/lib/intern/lead-managers';

async function fetchInternDirectory(): Promise<DirectoryPerson[]> {
  const res = await fetch('/api/outlook/directory');
  const json = (await res.json()) as { people?: DirectoryPerson[]; error?: string };
  if (!res.ok) throw new Error(json.error || 'directory_failed');
  return json.people ?? [];
}

export function LeadManagersCard({
  engagements,
  reportsToManagerId,
}: {
  engagements: LeadManagerEngagement[];
  reportsToManagerId?: string | null;
}) {
  const directoryQuery = useQuery({
    queryKey: ['outlook-directory', 'intern-managers'],
    queryFn: fetchInternDirectory,
  });
  const managers = resolveLeadManagers(
    engagements,
    directoryQuery.data ?? [],
    reportsToManagerId,
  );

  return (
    <DashSection icon={Users} title="My managers" meta={managers.length ? String(managers.length) : undefined} className="h-fit" bodyClassName="p-0">
      {directoryQuery.isPending ? (
        <p className="px-4 py-3 text-[13px] text-ink-muted">Loading...</p>
      ) : directoryQuery.isError ? (
        <p className="px-4 py-3 text-[13px] text-ink-muted">Could not load.</p>
      ) : managers.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-ink-muted">None assigned.</p>
      ) : (
        <ul className="max-h-[14rem] overflow-y-auto">
          {managers.map((manager) => (
            <li
              key={manager.id}
              className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-2.5 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium leading-tight text-ink">
                  {manager.name}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] leading-tight text-ink-muted">
                  {manager.email}
                </p>
              </div>
              <Link
                href={internManagerComposeHref(manager.email)}
                aria-label={`Email ${manager.name}`}
                className="grid h-control-sm w-control-sm shrink-0 place-items-center rounded-md border-1.5 border-line-strong bg-surface-raised text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}
