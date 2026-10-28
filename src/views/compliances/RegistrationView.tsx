'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { OwnerChip } from '@/components/ui/spectrum-chip';
import { StepMark, type StepState } from '@/components/ui/step-track';
import { EmptyState } from '@/components/ui/empty-state';
import { useApp } from '@/context/AppContext';
import { getChecklistStepTimelineLabel, getRegistrationPhases } from '@/data/checklist';
import type { CredentialsPayload } from '@/lib/client-portal/credentials';
import { adminProjectStepPath, internEngagementStepPath } from '@/lib/projects/project-step-path';
import { formatWindow } from '@/lib/projects/schedule-windows';
import { cn } from '@/lib/utils';
import type { ComplianceScope } from '@/views/compliances/compliance-scope';
import { isIdentifier, plainDate } from '@/views/compliances/spectrum-status';
import { Fact, RailCard, WordChip } from '@/views/compliances/spectrum-parts';
import {
  parseRegistrationKey,
  regDateLabel,
  registrationRows,
  workbookRowKey,
  type RegistrationRow,
} from '@/views/compliances/registration-rows';

const OWNER_LABEL = { client: 'Client', sbc: 'SBC', mca: 'Authority', manager: 'Manager' } as const;

/** The stored number and date of one registration, from the credentials workbook. */
interface StoredRegistration {
  number: string | null;
  date: string | null;
}

/**
 * The credentials workbook holds the registration numbers staff typed in as
 * well as the ones read from the steps. Only the "Registrations" row of this
 * step is kept; the rest of the payload (logins, secrets) is dropped at once.
 * A failure (for example no encryption key on the server) leaves the step's
 * own answers as the only source.
 */
function useStoredRegistration(engagementId: string | undefined, rowKey: string | undefined) {
  return useQuery({
    queryKey: ['registration-stored', engagementId, rowKey],
    enabled: Boolean(engagementId && rowKey),
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<StoredRegistration | null> => {
      const res = await fetch(`/api/client/credentials?engagementId=${encodeURIComponent(engagementId!)}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as { credentials?: CredentialsPayload };
      const row = data.credentials?.sheets.reg.rows.find((r) => r.key === rowKey);
      if (!row) return null;
      return { number: row.cells.number?.v?.trim() || null, date: row.cells.date?.v?.trim() || null };
    },
  });
}

/** Three workflow stages (Client, SBC, authority) as ST5 marks. */
function stageMarks(row: RegistrationRow): StepState[] {
  if (row.word === 'Done') return ['done', 'done', 'done'];
  if (row.stage === 'approval') return ['done', 'done', 'now'];
  if (row.stage === 'filing') return ['done', 'now', 'next'];
  if (row.stage === 'collection' || row.word === 'Waiting') return ['now', 'next', 'next'];
  if (row.word === 'In progress') return ['done', 'now', 'next'];
  return ['next', 'next', 'next'];
}

/**
 * REGISTRATION RECORD — one registration-phase step for one client (prototype
 * RegistrationScreen / ItemScreen, kind "reg").
 *
 * The head carries the name, the form, the authority and the client, the
 * status and owner chips and the one main button, which opens the step
 * workspace where every action on the step lives (submit, review, request
 * from client, documents). The facts are the step's own: status, stage, who
 * holds it, the lead, the due date from the checklist rule or the manager's
 * window, the completion date, and the registration number and date when the
 * step's answers or the credentials workbook hold them. No number is ever
 * made up.
 */
export function RegistrationView({
  shellBase,
  scope,
  recordKey,
}: {
  shellBase: string;
  scope: ComplianceScope;
  recordKey: string;
}) {
  const now = useMemo(() => new Date(), []);
  const { getStateForEngagement, refreshEngagementChecklist, internOptions, teamMembers } = useApp();
  const parsed = parseRegistrationKey(recordKey);
  const engagement = parsed ? scope.engagements.find((e) => e.id === parsed.engagementId) : undefined;
  const item = parsed ? getRegistrationPhases().flatMap((p) => p.items).find((i) => i.id === parsed.itemId) : undefined;
  const engagementId = engagement?.id;

  // The list reads the slim checklist index; the record loads the full answers once.
  useEffect(() => {
    if (engagementId) void refreshEngagementChecklist(engagementId);
  }, [engagementId, refreshEngagementChecklist]);

  const rows = useMemo(
    () => (engagement ? registrationRows([engagement], getStateForEngagement, now) : []),
    [engagement, getStateForEngagement, now],
  );
  const row = item ? rows.find((r) => r.item.id === item.id) : undefined;
  const stored = useStoredRegistration(engagementId, item ? workbookRowKey(item) : undefined);
  const basePath = `${shellBase}/registrations`;

  if (!engagement || !item || !row) {
    return (
      <EmptyState
        title="This registration is not in your clients"
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link href={basePath}>Open registrations</Link>
          </Button>
        }
      />
    );
  }

  const people = [...teamMembers, ...internOptions];
  const nameOf = (id: string | undefined) => (id ? people.find((p) => p.id === id)?.name : undefined);
  const lead = nameOf(engagement.internId);
  const assignee = nameOf(row.assigneeId);
  const number = stored.data?.number ?? row.number ?? null;
  const regDate = row.registrationDate ? plainDate(row.registrationDate, now) : stored.data?.date ?? null;
  const date = regDateLabel(row, now);
  const stepHref =
    shellBase === '/app/intern'
      ? internEngagementStepPath(engagement, item)
      : adminProjectStepPath(engagement, item, shellBase === '/app/manager' ? '/app/manager' : '/app/admin');
  const marks = stageMarks(row);
  const others = rows.filter((r) => r.key !== row.key && r.word !== 'Not needed' && r.word !== 'Done').slice(0, 6);

  return (
    <PageTransition>
      <SEO title={`${row.name} · ${engagement.companyName} — VCFO Suite`} description={`${row.name} for ${engagement.companyName}.`} path={`${basePath}/${recordKey}`} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {/* R-02 plain head: the name, a muted meta line, the chips, the facts and the one main button. */}
        <header className="grid gap-3" aria-label="Registration">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-[1_1_320px]">
              <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">{row.name}</h1>
              <p className="text-[13.5px] text-ink-muted">
                {row.form ? <span>{row.form} · </span> : null}
                {row.authority} · {engagement.companyName}
              </p>
            </div>
            <span className="flex flex-wrap items-center gap-2">
              {row.word === 'Not needed' ? <span className="text-[13px] text-ink-muted">Not needed</span> : <WordChip word={row.word} />}
              {row.owner ? <OwnerChip owner={row.owner} label={OWNER_LABEL[row.owner]} /> : null}
            </span>
            <Button asChild>
              <Link href={stepHref}>
                Open step
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <Fact k="Number" className={cn(number && isIdentifier(number) && 'font-mono')}>
              {number ?? <span className="font-normal text-ink-faint">Not recorded</span>}
            </Fact>
            <Fact k={row.word === 'Done' ? 'Done on' : 'Due'} className={date.className}>
              {date.text}
            </Fact>
            {regDate ? <Fact k="Date of registration">{regDate}</Fact> : null}
            {row.window ? <Fact k="Window">{formatWindow(row.window)}</Fact> : null}
            <Fact k="Lead">{lead ?? '—'}</Fact>
            {assignee && assignee !== lead ? <Fact k="Assigned to">{assignee}</Fact> : null}
            <Fact k="Step">{`${row.step} of registration`}</Fact>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-4">
            <DashSection title="Progress" bodyClassName="p-0">
              <ul>
                {[
                  ['Documents from the client', 'Client'],
                  ['Application filed by SBC', 'SBC'],
                  [`Review by ${row.authority}`, 'Authority'],
                ].map(([label, who], i) => (
                  <li key={label} className={cn('flex items-center gap-3 border-t border-line-soft px-4 py-2.5 first:border-t-0', marks[i] === 'now' && 'bg-surface-sunken/60')}>
                    <StepMark state={marks[i]!} tone={row.word === 'Overdue' ? 'bad' : row.word === 'Waiting' ? 'teal' : 'prog'} size={20} />
                    <span className="min-w-0 flex-1">
                      <b className={cn('block truncate text-[14px]', marks[i] === 'now' ? 'font-medium text-ink' : 'font-normal text-ink-2')}>{label}</b>
                      <span className="block text-[12.5px] text-ink-muted">
                        {marks[i] === 'done' ? 'Done' : marks[i] === 'now' ? `With ${who}` : 'Next'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </DashSection>

            <DashSection title="From the client" meta={`${item.infoRequired.length}`} bodyClassName="p-0">
              {item.infoRequired.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-ink-faint">None</p>
              ) : (
                <ul>
                  {item.infoRequired.map((doc) => (
                    <li key={doc} className="border-t border-line-soft px-4 py-2.5 text-[14px] text-ink-2 first:border-t-0">
                      {doc}
                    </li>
                  ))}
                </ul>
              )}
            </DashSection>
          </div>

          <div className="grid min-w-0 gap-3">
            <DashSection title="About">
              <div className="grid gap-2 text-[14px] leading-relaxed text-ink-2">
                {item.notes ? <p>{item.notes}</p> : null}
                <p className="text-ink-muted">{getChecklistStepTimelineLabel(item)}</p>
                {item.forms.length ? <p className="text-ink-muted">Forms: {item.forms.join(', ')}</p> : null}
              </div>
            </DashSection>
            <RailCard
              title={`Open for ${engagement.companyName}`}
              items={others.map((r) => {
                const d = regDateLabel(r, now);
                return { key: r.key, title: r.name, sub: r.word, right: d.text, rightClass: d.className, href: `${basePath}/${encodeURIComponent(r.key)}` };
              })}
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
