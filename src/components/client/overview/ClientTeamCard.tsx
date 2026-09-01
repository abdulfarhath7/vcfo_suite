'use client';

import { Mail } from 'lucide-react';
import { AccentButton } from '@/components/noir';
import { ClientCard } from '@/components/client/overview/ClientCard';
import type { ClientOverviewTeamMember } from '@/lib/client-overview';
import { initialsFromName } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** Fallback when no PM/lead email is on file. Same address as `/contact`. */
const FIRM_EMAIL = 'info@vcfosuite.com';

/**
 * Modules 10 + 13 — your team, and Contact.
 *
 * Contact opens a pre-filled email draft in the client's own mail app. There is
 * no chat here, and no message backend to fake one against.
 */
export function ClientTeamCard({
  team,
  companyName,
}: {
  team: ClientOverviewTeamMember[];
  companyName: string;
}) {
  const primary = team.find((member) => member.role === 'Project Manager') ?? team[0];
  const mailTo = primary?.email ?? FIRM_EMAIL;
  const cc = team
    .filter((member) => member.email && member.email !== mailTo)
    .map((member) => member.email!)
    .join(',');

  const subject = encodeURIComponent(`${companyName} — question for the VCFO team`);
  const body = encodeURIComponent(
    `Hi ${primary?.name?.split(' ')[0] ?? 'team'},\n\n\n\n— sent from the ${companyName} client portal`,
  );
  const href = `mailto:${mailTo}?${cc ? `cc=${encodeURIComponent(cc)}&` : ''}subject=${subject}&body=${body}`;

  return (
    <ClientCard title="Your team">
      {team.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Your project manager and lead are being assigned. Reach us at{' '}
          <a
            href={`mailto:${FIRM_EMAIL}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {FIRM_EMAIL}
          </a>{' '}
          in the meantime.
        </p>
      ) : (
        <ul className="space-y-2">
          {team.map((member) => (
            <li key={member.id} className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11.5px] font-extrabold',
                  member.role === 'Project Manager'
                    ? 'bg-primary-light text-primary-dark'
                    : 'bg-[oklch(var(--phase-post-soft))] text-[oklch(var(--phase-post-text))]',
                )}
                aria-hidden
              >
                {initialsFromName(member.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-extrabold leading-tight text-ink">
                  {member.name}
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {member.role}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <AccentButton
          variant="outline"
          size="sm"
          className="min-h-11 w-full text-[12px] font-bold"
          onClick={() => {
            window.location.href = href;
          }}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Email your team
        </AccentButton>
      </div>
    </ClientCard>
  );
}
