'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Mail, Users } from 'lucide-react';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import {
  internManagerComposeHref,
  resolveLeadManagers,
  type LeadManagerEngagement,
} from '@/lib/lead-managers';

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
    <section className="surface h-fit min-w-0 overflow-hidden">
      <div className="flex min-w-0 items-center gap-2 px-3 pt-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Users className="h-3 w-3" aria-hidden />
        </span>
        <h2 className="min-w-0 truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink">
          My managers
        </h2>
      </div>
      <div className="px-3 pb-2.5 pt-1.5">
        {directoryQuery.isPending ? (
          <p className="py-1 text-[12px] text-muted-foreground">Loading...</p>
        ) : directoryQuery.isError ? (
          <p className="py-1 text-[12px] text-muted-foreground">Could not load.</p>
        ) : managers.length === 0 ? (
          <p className="py-1 text-[12px] text-muted-foreground">None assigned.</p>
        ) : (
          <ul className="max-h-[11rem] space-y-0.5 overflow-y-auto">
            {managers.map((manager) => (
              <li key={manager.id} className="flex min-w-0 items-center gap-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-extrabold leading-tight text-ink">
                    {manager.name}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {manager.email}
                  </p>
                </div>
                <Link
                  href={internManagerComposeHref(manager.email)}
                  aria-label={`Email ${manager.name}`}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-primary ring-1 ring-primary/25 transition-colors hover:bg-primary-light"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
