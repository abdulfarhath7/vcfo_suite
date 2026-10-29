'use client';

import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronRight, ExternalLink, FileText } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { StatutoryCalendar } from '@/components/admin/StatutoryCalendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AreaPill, Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { SkeletonRows } from '@/components/ui/empty-state';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';
import { useFilings } from '@/hooks/use-filings';
import { useCompFilings, useReminder } from '@/components/client-portal/pages/compliances/api';
import { areaOf, portalFor } from '@/lib/client-portal/compliances';
import {
  filingStatus,
  financialYearForDate,
  financialYearLabel,
  financialYearMonths,
  monthKeyForDate,
  monthKeyOf,
  monthLabelOf,
  parseIsoDate,
  rowsInMonth,
  sortByDueDate,
  type FilingRow,
  type FilingStatus,
} from '@/lib/compliance/filings';
import { cn } from '@/lib/utils';
import {
  ALL_COMPANIES,
  normaliseCompanyParam,
  pickedCompany,
  rowsForCompany,
  soleCompany,
  type ComplianceScope,
} from '@/views/compliances/compliance-scope';
import {
  areaLabel,
  daysUntil,
  emptyCounts,
  FILING_WORD,
  filingWord,
  plainDate,
  SIX_TONE,
  STATUS_TILE,
  worstStatus,
  type SixWord,
} from '@/views/compliances/spectrum-status';
import { DateTile, StatusDonutCard, WordChip } from '@/views/compliances/spectrum-parts';
import { MonthGrid, YearGrid, type CalendarMark } from '@/views/compliances/calendar-grids';
import { AreaShort, ClientDot, ClientTag } from '@/views/compliances/identity';
import { FilingWindows } from '@/views/compliances/filing-windows';
import { MonthNav } from '@/views/compliances/month-nav';
import { useMayWriteFilings } from '@/views/compliances/use-register';

type CalendarView = 'month' | 'year' | 'timeline' | 'statutory';
const ALL_AREAS = 'all';
const LONG_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function firstOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * COMPLIANCE CALENDAR — the radar, one view for every role (VCFO Spectrum).
 *
 * A calendar bar (company, month picker, FY chip, area, view, a link to
 * Filings) sits above the register month grid, with the status donut, the
 * next deadline and the coming-up list in the right rail. A day opens a
 * popover with its filings. The year view shows the twelve months of the FY,
 * the timeline view draws the filing windows as bars that managers move
 * (`FilingWindows`), and the "Statutory" view keeps the firm's statutory month grid
 * (`StatutoryCalendar`: act legend, All / Overdue scope, keyboard grid,
 * full-screen mode). One company selection narrows all of them. Every shell
 * renders this exact layout; WHAT it shows is decided by `getFilings` through
 * `AuthContext` and by the roster in `scope`. Nothing is keyed off the role.
 *
 * `?date=` opens the month of that date with the day picked; `?company=`
 * starts on that company.
 *
 * Pre-incorporation is read off `scope` (derived by the caller from
 * `isIncorporated`, never a rule of this view's own). The grid stays in its
 * genuine empty state under the notice; nothing is invented to fill it.
 */
export function ComplianceCalendarView({
  basePath,
  scope,
}: {
  basePath: string;
  scope: ComplianceScope;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const todayIso = now.toISOString().slice(0, 10);
  const { engagements } = scope;
  const sole = soleCompany(engagements);

  const dateParam = parseIsoDate(params.get('date'));
  const [month, setMonth] = useState<Date>(() => firstOfMonth(dateParam ?? now));
  const [pickedDay, setPickedDay] = useState<string | null>(() => (dateParam ? dateParam.toISOString().slice(0, 10) : null));
  const [view, setView] = useState<CalendarView>('month');
  const [area, setArea] = useState<string>(ALL_AREAS);
  const [pickedId, setPickedId] = useState<string>(() => normaliseCompanyParam(params.get('company'), engagements));
  const companyId = sole ? sole.id : pickedId;
  const picked = pickedCompany(engagements, companyId);
  const pickedPreIncorporation = picked && scope.preIncorporationIds.has(picked.id) ? picked : null;

  const mayWrite = useMayWriteFilings();
  const fyStartYear = financialYearForDate(month).startYear;
  const query = useFilings({ fyStartYear });
  const scopedRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const rows = useMemo(() => rowsForCompany(scopedRows, companyId), [scopedRows, companyId]);

  const monthKey = monthKeyForDate(month);
  const nowKey = monthKeyForDate(now);
  const months = useMemo(() => financialYearMonths(fyStartYear), [fyStartYear]);
  const monthRows = useMemo(() => sortByDueDate(rowsInMonth(rows, monthKey)), [rows, monthKey]);

  // Area chips count what the view shows: this month in month view, the year otherwise.
  const counted = view === 'month' ? monthRows : rows;
  const areas = useMemo(() => [...new Set(counted.map((row) => row.compliance))].sort((a, b) => a.localeCompare(b)), [counted]);
  const areaOn = area !== ALL_AREAS && areas.includes(area) ? area : ALL_AREAS;
  const inArea = (row: FilingRow) => areaOn === ALL_AREAS || row.compliance === areaOn;

  const marks: CalendarMark[] = useMemo(
    () =>
      rows
        .filter((row) => areaOn === ALL_AREAS || row.compliance === areaOn)
        .map((row) => ({
        id: row.id,
        date: row.dueDate.slice(0, 10),
        label: row.particular,
        status: filingStatus(row, now),
      })),
    [rows, areaOn, now],
  );

  // The rail always reads this calendar month (the donut is "this month", R-25).
  const nowMonthCounts = useMemo(() => {
    const c = emptyCounts();
    for (const row of rowsInMonth(rows, nowKey)) c[filingStatus(row, now)] += 1;
    return c;
  }, [rows, nowKey, now]);
  const upcoming = useMemo(
    () => sortByDueDate(rows.filter((row) => !row.filedOn && row.dueDate.slice(0, 10) >= todayIso)),
    [rows, todayIso],
  );
  const next = upcoming[0];
  // "Remind me": the caller's own reminder on the next deadline (existing route, scoped in the repository).
  const facts = useCompFilings(fyStartYear);
  const reminder = useReminder();
  const nextReminder = next ? (facts.data?.rows.find((f) => f.id === next.id)?.reminderOn ?? null) : null;
  const late = useMemo(() => sortByDueDate(rows.filter((row) => filingStatus(row, now) === 'overdue'))[0], [rows, now]);

  const companyQuery = !sole && companyId !== ALL_COMPANIES ? `&company=${companyId}` : '';
  const showCompany = companyId === ALL_COMPANIES;
  const filingsHref = (row?: FilingRow) =>
    row
      ? `${basePath}/filings?cadence=monthly&period=${monthKeyOf(row.dueDate)}${companyQuery}`
      : `${basePath}/filings${companyQuery ? `?${companyQuery.slice(1)}` : ''}`;

  // A filing opens its record: the obligation page for that client.
  const recordHref = (row: FilingRow) => `${basePath}/obligations/${encodeURIComponent(row.obligationId)}?company=${row.engagementId}`;
  const factOf = (row: FilingRow) => facts.data?.rows.find((f) => f.id === row.id);

  const listRows = monthRows.filter(inArea);
  const dayRows = (day: string) => listRows.filter((row) => row.dueDate.slice(0, 10) === day);

  return (
    <PageTransition>
      <SEO
        title="Compliance calendar — VCFO Suite"
        description="Statutory filing obligations plotted by due date."
        path={`${basePath}/calendar`}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <h1 className="sr-only">Compliance calendar</h1>

        {/* Calendar bar: company, month, FY, area, view and the way to Filings. */}
        <div className="flex flex-wrap items-center gap-1.5 xl:flex-nowrap">
          {sole ? null : (
            <Select value={companyId} onValueChange={setPickedId}>
              <SelectTrigger aria-label="Company" className="h-8 w-auto min-w-[150px] max-w-[220px] flex-none gap-2 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMPANIES}>All companies</SelectItem>
                {engagements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className={cn(view !== 'month' && 'invisible')} aria-hidden={view !== 'month' || undefined}>
            <MonthNav
              value={monthKey}
              now={nowKey}
              onChange={(key) => {
                setMonth(new Date(`${key}-01T00:00:00Z`));
                setPickedDay(null);
              }}
            />
          </span>
          <span className="inline-flex h-8 flex-none items-center rounded-md bg-warning-soft px-2 text-[12px] font-medium text-warning">
            {financialYearLabel(fyStartYear)}
          </span>
          <SpectrumTabs
            label="Filter by area"
            className="min-w-0 xl:flex-shrink"
            items={[
              { key: ALL_AREAS, label: 'All', count: counted.length },
              ...areas.map((a) => ({ key: a, label: areaLabel(a), count: counted.filter((row) => row.compliance === a).length })),
            ]}
            value={areaOn}
            onChange={setArea}
          />
          <span className="ml-auto flex flex-none flex-wrap items-center gap-1.5">
            <SpectrumTabs
              label="Calendar view"
              items={[
                { key: 'month', label: 'Month' },
                { key: 'year', label: 'Year' },
                { key: 'timeline', label: 'Timeline' },
                { key: 'statutory', label: 'Statutory' },
              ]}
              value={view}
              onChange={(v) => setView(v as CalendarView)}
            />
            <Button size="sm" variant="secondary" className="h-8" asChild>
              <Link href={filingsHref()}>
                <FileText aria-hidden />
                Filings
              </Link>
            </Button>
          </span>
        </div>

        {view !== 'statutory' ? (
          pickedPreIncorporation ? (
            <PreIncorporationNotice scope={{ audience: scope.audience, companyName: pickedPreIncorporation.companyName }} />
          ) : !picked ? (
            <PreIncorporationPortfolioNote count={scope.preIncorporationIds.size} />
          ) : null
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-4">
            {view === 'statutory' ? (
              <StatutoryCalendar
                engagements={engagements}
                companyId={companyId}
                onCompanyChange={setPickedId}
                audience={scope.audience}
              />
            ) : query.isPending ? (
              <div className="surface p-4" aria-busy="true" aria-label="Loading calendar">
                <SkeletonRows rows={6} />
              </div>
            ) : view === 'timeline' ? (
              <div className="surface min-w-0 p-3">
                <FilingWindows
                  rows={rows.filter(inArea)}
                  fyStartYear={fyStartYear}
                  todayIso={todayIso}
                  now={now}
                  mayWrite={mayWrite}
                  hrefOf={recordHref}
                />
              </div>
            ) : view === 'year' ? (
              <div className="surface min-w-0 p-3">
                <YearGrid
                  months={months}
                  marks={marks}
                  todayIso={todayIso}
                  onPick={(key) => {
                    setMonth(new Date(`${key}-01T00:00:00Z`));
                    setPickedDay(null);
                    setView('month');
                  }}
                />
              </div>
            ) : (
              <>
                <div className="surface min-w-0 p-3">
                  <MonthGrid
                    year={month.getUTCFullYear()}
                    month={month.getUTCMonth()}
                    todayIso={todayIso}
                    marks={marks}
                    picked={pickedDay}
                    onPick={setPickedDay}
                    dayTitle={(day) => <DayHead day={day} rows={dayRows(day)} now={now} />}
                    dayBody={(day) => (
                      <ul>
                        {dayRows(day).map((row) => (
                          <PopRow key={row.id} row={row} now={now} href={recordHref(row)} />
                        ))}
                      </ul>
                    )}
                  />
                </div>
                <DashSection
                  title={monthLabelOf(monthKey)}
                  meta={
                    <Link
                      href={`${basePath}/filings?cadence=monthly&period=${monthKey}&fy=${fyStartYear}${companyQuery}`}
                      className="text-[13px] font-medium text-brand-text hover:underline"
                    >
                      View this month&rsquo;s filings
                    </Link>
                  }
                  bodyClassName="p-0"
                >
                  {listRows.length === 0 ? (
                    <p className="px-4 py-3 text-[13px] text-ink-faint">Nothing falls due</p>
                  ) : (
                    <ul>
                      {listRows.map((row) => (
                        <DayRow key={row.id} row={row} now={now} href={recordHref(row)} showCompany={showCompany} />
                      ))}
                    </ul>
                  )}
                </DashSection>
              </>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
            <StatusDonutCard counts={nowMonthCounts} caption={LONG_MON[now.getUTCMonth()]!} label="This month by status" />
            {next ? (
              <NextDeadlineCard
                row={next}
                now={now}
                showCompany={showCompany}
                onOpen={() => router.push(recordHref(next))}
                dataReceivedOn={factOf(next)?.dataReceivedOn ?? null}
                factsLoaded={Boolean(facts.data)}
                late={late}
                lateHref={late ? recordHref(late) : undefined}
                reminderOn={nextReminder}
                reminderBusy={reminder.set.isPending || reminder.clear.isPending}
                onRemind={() => reminder.set.mutate(next.id)}
                onClearReminder={() => reminder.clear.mutate(next.id)}
              />
            ) : null}
            <div className="md:col-span-2 lg:col-span-1">
              <ComingUpCard rows={upcoming} now={now} showCompany={showCompany} hrefOf={recordHref} />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function DayRow({ row, now, href, showCompany }: { row: FilingRow; now: Date; href: string; showCompany: boolean }) {
  return (
    <li className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-2 first:border-t-0" data-ask-focus={row.id}>
      <DateTile iso={row.dueDate} status={filingStatus(row, now)} />
      <AreaPill area={areaLabel(row.compliance)} className="hidden sm:inline-flex" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1">
          <Link href={href} className="block truncate text-[14px] font-medium text-ink hover:text-brand-text">
            {row.particular}
          </Link>
          <WhatsThisButton compact kind="compliance" refId={row.obligationId} label={row.particular} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-ink-muted">
          {showCompany ? (
            <>
              <ClientDot id={row.engagementId} />
              <span className="truncate">{row.companyName} · </span>
            </>
          ) : null}
          <span className="truncate">
            {row.periodLabel ? `${row.periodLabel} · ` : ''}
            due {plainDate(row.dueDate, now)}
          </span>
        </span>
      </span>
      <WordChip word={filingWord(row, now)} />
    </li>
  );
}

/** 44 x 48 px date tile of the calendar rail and popover: the day over the weekday. */
function CalDateTile({ iso, status, className }: { iso: string; status: FilingStatus; className?: string }) {
  const d = parseIsoDate(iso);
  return (
    <span className={cn('grid h-12 w-11 flex-none place-content-center rounded-md text-center leading-none', STATUS_TILE[status], className)} aria-hidden>
      <b className="text-[18px] font-medium tabular-nums">{d ? d.getUTCDate() : '—'}</b>
      <small className="mt-1 text-[11px] font-medium opacity-85">{d ? SHORT_DOW[d.getUTCDay()] : ''}</small>
    </span>
  );
}

/** The dot-only status chip for narrow rails; the word stays for screen readers. */
function DotChip({ word }: { word: SixWord }) {
  const tone: ChipTone = SIX_TONE[word];
  return (
    <span title={word} className={cn('inline-flex h-6 w-6 flex-none items-center justify-center rounded-md', DOT_SOFT[tone])}>
      <i className={cn('h-[7px] w-[7px] rounded-[2px]', DOT_MID[tone])} aria-hidden />
      <span className="sr-only">{word}</span>
    </span>
  );
}

const DOT_SOFT: Partial<Record<ChipTone, string>> = {
  ok: 'bg-positive-soft',
  warn: 'bg-warning-soft',
  bad: 'bg-danger-soft',
  idle: 'bg-surface-sunken',
  prog: 'bg-brand-soft',
  teal: 'bg-waiting-soft',
};
const DOT_MID: Partial<Record<ChipTone, string>> = {
  ok: 'bg-positive-mid',
  warn: 'bg-warning-mid',
  bad: 'bg-danger-mid',
  idle: 'bg-upcoming-mid',
  prog: 'bg-brand',
  teal: 'bg-waiting-mid',
};

/** The day popover head: a date tile, the long date and the count. */
function DayHead({ day, rows, now }: { day: string; rows: FilingRow[]; now: Date }) {
  const d = parseIsoDate(day)!;
  const status = rows.length ? worstStatus(rows.map((row) => filingStatus(row, now))) : 'upcoming';
  return (
    <span className="flex items-center gap-2.5">
      <CalDateTile iso={day} status={status} className="h-11 w-10" />
      <span className="min-w-0">
        <b className="block text-[14px] font-medium">
          {LONG_DOW[d.getUTCDay()]} {d.getUTCDate()} {LONG_MON[d.getUTCMonth()]}
        </b>
        <span className="block text-[12px] font-normal text-ink-muted">{rows.length === 1 ? '1 filing' : `${rows.length} filings`}</span>
      </span>
    </span>
  );
}

/** One filing of a day popover: area short tag, the filing, the client with its dot, and the status chip. */
function PopRow({ row, now, href }: { row: FilingRow; now: Date; href: string }) {
  return (
    <li className="border-t border-line-soft first:border-t-0">
      <Link href={href} className="flex items-center gap-2 px-4 py-2 hover:bg-surface-sunken">
        <AreaShort area={areaLabel(row.compliance)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink">
            {row.particular}
            {row.periodLabel ? ` · ${row.periodLabel}` : ''}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-muted">
            <ClientDot id={row.engagementId} />
            <span className="truncate">{row.companyName}</span>
          </span>
        </span>
        <WordChip word={filingWord(row, now)} />
      </Link>
    </li>
  );
}

/** The government portal of a filing, opened in a new tab. */
function PortalLink({ row }: { row: FilingRow }) {
  const [label, href] = portalFor({ area: areaOf(row.authority, row.compliance), name: row.particular });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-grid h-6 w-6 flex-none place-items-center rounded-sm text-ink-faint hover:bg-surface-sunken hover:text-brand-text"
      aria-label={`Open ${label}`}
      title={`Open ${label}`}
    >
      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
    </a>
  );
}

/** The next unfiled due date: a days tile, the filing with its portal, its area, data state and client, and a late line. */
function NextDeadlineCard({
  row,
  now,
  showCompany,
  onOpen,
  dataReceivedOn,
  factsLoaded,
  late,
  lateHref,
  reminderOn,
  reminderBusy,
  onRemind,
  onClearReminder,
}: {
  row: FilingRow;
  now: Date;
  showCompany: boolean;
  onOpen: () => void;
  /** The day the client's data came in (filing facts), or null. */
  dataReceivedOn: string | null;
  /** The state chip shows only once the facts have loaded. */
  factsLoaded: boolean;
  late?: FilingRow;
  lateHref?: string;
  reminderOn: string | null;
  reminderBusy: boolean;
  onRemind: () => void;
  onClearReminder: () => void;
}) {
  const days = daysUntil(row.dueDate, now) ?? 0;
  const lateDays = late ? -(daysUntil(late.dueDate, now) ?? 0) : 0;
  const received = Boolean(dataReceivedOn) || row.rawStatus === 'in-progress';
  return (
    <section className="surface overflow-hidden" aria-label="Next deadline">
      <div className="px-4 pb-3.5 pt-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
          <i className="h-1.5 w-1.5 rounded-[2px] bg-highlight-bright" aria-hidden />
          Next deadline
        </div>
        <div className="mt-2.5 flex items-center gap-3.5">
          <button
            type="button"
            onClick={onOpen}
            className="grid h-[62px] w-[58px] flex-none place-content-center rounded-md bg-surface-sunken text-center leading-none text-ink hover:bg-line-soft"
            aria-label={`${days} days left · open ${row.particular}`}
          >
            <b className="text-[28px] font-medium tabular-nums">{days}</b>
            <small className="mt-1 text-[11px] font-medium tracking-wide text-ink-muted">{days === 1 ? 'DAY' : 'DAYS'}</small>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1 text-[18px] font-medium leading-tight tracking-tight text-ink" title={row.particular}>
              <span className="truncate">{row.particular}</span>
              <PortalLink row={row} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <AreaShort area={areaLabel(row.compliance)} />
              {factsLoaded ? (
                <Chip tone={received ? 'ok' : 'warn'} className="h-5 min-w-0 px-1.5 text-[11.5px]">
                  {received ? 'Data received' : `Data from ${shortName(row.companyName)}`}
                </Chip>
              ) : null}
              {showCompany ? <ClientTag id={row.engagementId} name={row.companyName} /> : null}
            </div>
          </div>
        </div>
        <div className="mt-3.5 flex gap-2">
          <Button size="sm" className="flex-1" onClick={onOpen}>
            Open filing
            <ArrowRight aria-hidden />
          </Button>
          {reminderOn ? (
            <button type="button" onClick={onClearReminder} disabled={reminderBusy} title="Turn the reminder off" className="disabled:opacity-50">
              <Chip tone="ok" className="h-[30px]">{`Reminder ${plainDate(reminderOn, now)}`}</Chip>
            </button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onRemind} disabled={reminderBusy}>
              Remind me
            </Button>
          )}
        </div>
      </div>
      {late && lateHref ? (
        <Link href={lateHref} className="flex w-full items-center gap-2 border-t border-line-soft px-4 py-2.5 text-left text-[12.5px] hover:bg-surface-sunken">
          <i className="h-2 w-2 flex-none rounded-[2px] bg-danger-mid" aria-hidden />
          <b className="truncate font-medium text-ink">
            {late.particular}
            {showCompany ? ` · ${late.companyName}` : ''}
          </b>
          <span className="flex-none font-medium text-danger">
            {lateDays} day{lateDays === 1 ? '' : 's'} late
          </span>
          <ChevronRight className="ml-auto h-3.5 w-3.5 flex-none text-ink-muted" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

/** "Northwind Pvt Ltd" reads "Northwind" in tight spots. */
function shortName(name: string): string {
  return name.replace(/\s+(India\s+)?(Private|Pvt\.?)\s+(Limited|Ltd\.?)$/i, '').replace(/\s+(LLP|Limited|Ltd\.?)$/i, '');
}

interface ComingItem {
  key: string;
  day: string;
  name: string;
  /** Text after the name: the client, or "n clients". */
  who: string | null;
  row: FilingRow;
  area: string;
  status: FilingStatus;
  word: SixWord;
}

/**
 * Coming up: up to seven filings, one date tile per day. One filing that falls
 * due for several clients on one day is one row, "Filing · n clients".
 */
function ComingUpCard({
  rows,
  now,
  showCompany,
  hrefOf,
}: {
  rows: FilingRow[];
  now: Date;
  showCompany: boolean;
  hrefOf: (row: FilingRow) => string;
}) {
  const items: ComingItem[] = [];
  for (const row of rows) {
    const day = row.dueDate.slice(0, 10);
    const status = filingStatus(row, now);
    const hit = items.find((x) => x.day === day && x.name === row.particular);
    if (hit) {
      const n = rows.filter((r) => r.dueDate.slice(0, 10) === day && r.particular === row.particular).length;
      hit.who = `${n} clients`;
      hit.status = worstStatus([hit.status, status]);
      hit.word = FILING_WORD[hit.status];
    } else {
      if (items.length >= 7) break;
      items.push({
        key: row.id,
        day,
        name: row.particular,
        who: showCompany ? shortName(row.companyName) : null,
        row,
        area: areaLabel(row.compliance),
        status,
        word: filingWord(row, now),
      });
    }
  }
  const days: Array<[string, ComingItem[]]> = [];
  for (const it of items) {
    const last = days[days.length - 1];
    if (last && last[0] === it.day) last[1].push(it);
    else days.push([it.day, [it]]);
  }
  return (
    <section className="surface px-4 pb-1.5 pt-3.5" aria-label="Coming up">
      <div className="mb-1 flex items-center gap-2 border-b border-line-soft pb-2">
        <h2 className="flex-1 text-[13px] font-medium text-ink">Coming up</h2>
        <span className="text-[11px] text-ink-muted">{items.length}</span>
      </div>
      {days.length === 0 ? (
        <p className="py-3 text-[13px] text-ink-faint">None</p>
      ) : (
        days.map(([d, list]) => (
          <div key={d} className="flex items-center gap-2.5 border-t border-line-soft py-2.5 first:border-t-0">
            <CalDateTile iso={d} status={worstStatus(list.map((x) => x.status))} />
            <ul className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
              {list.map((x) => (
                <li key={x.key} className="min-w-0">
                  <Link href={hrefOf(x.row)} className="flex w-full min-w-0 items-center gap-2 text-left hover:text-brand-text">
                    <AreaShort area={x.area} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      <span>{x.name}</span>
                      {x.who ? <span className="font-normal text-ink-muted"> · {x.who}</span> : null}
                    </span>
                    <DotChip word={x.word} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
