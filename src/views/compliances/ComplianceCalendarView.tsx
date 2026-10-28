'use client';

import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { StatutoryCalendar } from '@/components/admin/StatutoryCalendar';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import { Button } from '@/components/ui/button';
import { AreaPill, Chip } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { SkeletonRows } from '@/components/ui/empty-state';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';
import { useFilings } from '@/hooks/use-filings';
import { useCompFilings, useReminder } from '@/components/client-portal/pages/compliances/api';
import {
  filingStatus,
  financialYearForDate,
  financialYearMonths,
  monthKeyForDate,
  monthKeyOf,
  monthLabelOf,
  parseIsoDate,
  rowsInMonth,
  sortByDueDate,
  type FilingRow,
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
import { areaLabel, daysUntil, emptyCounts, filingWord, plainDate, worstStatus } from '@/views/compliances/spectrum-status';
import { CompactChip, DateTile, StatusDonutCard, WordChip } from '@/views/compliances/spectrum-parts';
import { MonthGrid, YearGrid, type CalendarMark } from '@/views/compliances/calendar-grids';

type CalendarView = 'month' | 'year' | 'statutory';
const ALL_AREAS = 'all';
const LONG_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function firstOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

/**
 * COMPLIANCE CALENDAR — the radar, one view for every role (VCFO Spectrum).
 *
 * A calendar bar (company, month, area, view, a link to Filings) sits above
 * the register month grid, with the status donut, the next deadline and the
 * coming-up list in the right rail. The year view shows the twelve months of
 * the FY, and the "Statutory" view keeps the firm's statutory month grid
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

  const listRows = pickedDay && pickedDay.startsWith(monthKey)
    ? monthRows.filter((row) => row.dueDate.slice(0, 10) === pickedDay && inArea(row))
    : monthRows.filter(inArea);
  const pickedDate = pickedDay ? parseIsoDate(pickedDay) : null;
  const listTitle =
    pickedDate && pickedDay?.startsWith(monthKey)
      ? `${LONG_DOW[pickedDate.getUTCDay()]} ${pickedDate.getUTCDate()} ${LONG_MON[pickedDate.getUTCMonth()]}`
      : monthLabelOf(monthKey);

  const stepMonth = (n: number) => {
    setMonth((m) => addMonths(m, n));
    setPickedDay(null);
  };

  return (
    <PageTransition>
      <SEO
        title="Compliance calendar — VCFO Suite"
        description="Statutory filing obligations plotted by due date."
        path={`${basePath}/calendar`}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <h1 className="sr-only">Compliance calendar</h1>

        {/* Calendar bar: company, month, area, view and the way to Filings. */}
        <div className="surface flex flex-wrap items-center gap-2.5 px-3 py-2.5">
          {sole ? null : <CompanyPicker engagements={engagements} value={companyId} onChange={setPickedId} />}
          <span className="inline-flex items-center gap-1">
            <Button size="icon" variant="quiet" className="h-7 w-7" onClick={() => stepMonth(-1)} aria-label="Previous month">
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-[96px] text-center text-[15px] font-medium text-ink">{monthLabelOf(monthKey)}</span>
            <Button size="icon" variant="quiet" className="h-7 w-7" onClick={() => stepMonth(1)} aria-label="Next month">
              <ChevronRight aria-hidden />
            </Button>
            {monthKey !== nowKey ? (
              <Button size="sm" variant="quiet" onClick={() => { setMonth(firstOfMonth(now)); setPickedDay(null); }}>
                Today
              </Button>
            ) : null}
          </span>
          <SpectrumTabs
            label="Filter by area"
            items={[
              { key: ALL_AREAS, label: 'All', count: counted.length },
              ...areas.map((a) => ({ key: a, label: areaLabel(a), count: counted.filter((row) => row.compliance === a).length })),
            ]}
            value={areaOn}
            onChange={setArea}
          />
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <SpectrumTabs
              label="Calendar view"
              items={[
                { key: 'month', label: 'Month' },
                { key: 'year', label: 'Year' },
                { key: 'statutory', label: 'Statutory' },
              ]}
              value={view}
              onChange={(v) => setView(v as CalendarView)}
            />
            <Button size="sm" variant="secondary" asChild>
              <Link href={filingsHref()}>
                <FileSpreadsheet aria-hidden />
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
                  />
                </div>
                <DashSection
                  title={listTitle}
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
                        <DayRow key={row.id} row={row} now={now} href={filingsHref(row)} showCompany={showCompany} />
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
                onOpen={() => router.push(filingsHref(next))}
                late={late}
                lateHref={late ? filingsHref(late) : undefined}
                reminderOn={nextReminder}
                reminderBusy={reminder.set.isPending || reminder.clear.isPending}
                onRemind={() => reminder.set.mutate(next.id)}
                onClearReminder={() => reminder.clear.mutate(next.id)}
              />
            ) : null}
            <div className="md:col-span-2 lg:col-span-1">
              <ComingUpCard rows={upcoming.slice(0, 7)} now={now} showCompany={showCompany} hrefOf={filingsHref} />
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
        <span className="block truncate text-[12.5px] text-ink-muted">
          {showCompany ? `${row.companyName} · ` : ''}
          {row.periodLabel ? `${row.periodLabel} · ` : ''}
          due {plainDate(row.dueDate, now)}
        </span>
      </span>
      <WordChip word={filingWord(row, now)} />
    </li>
  );
}

/** The next unfiled due date: a days tile, the filing, its area and client, and a late line. */
function NextDeadlineCard({
  row,
  now,
  showCompany,
  onOpen,
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
  late?: FilingRow;
  lateHref?: string;
  reminderOn: string | null;
  reminderBusy: boolean;
  onRemind: () => void;
  onClearReminder: () => void;
}) {
  const days = daysUntil(row.dueDate, now) ?? 0;
  const lateDays = late ? -(daysUntil(late.dueDate, now) ?? 0) : 0;
  return (
    <section className="surface overflow-hidden" aria-label="Next deadline">
      <div className="px-4 pb-3.5 pt-4">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
          <i className="h-1.5 w-1.5 rounded-[2px] bg-highlight-bright" aria-hidden />
          Next deadline
        </div>
        <div className="mt-2.5 flex items-center gap-3.5">
          <span className="grid h-[62px] w-[58px] flex-none place-content-center rounded-md bg-upcoming-soft text-center leading-none text-ink" aria-label={`${days} days left`}>
            <b className="text-[28px] font-medium">{days}</b>
            <small className="mt-1 text-[11px] font-medium tracking-wide text-ink-muted">{days === 1 ? 'DAY' : 'DAYS'}</small>
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-medium leading-tight text-ink" title={row.particular}>
              {row.particular}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <AreaPill area={areaLabel(row.compliance)} />
              <CompactChip word={filingWord(row, now)} />
            </div>
            <p className="mt-1 truncate text-[12.5px] text-ink-muted">
              {showCompany ? `${row.companyName} · ` : ''}due {plainDate(row.dueDate, now)}
            </p>
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

/** Coming up: one date tile per day, each filing with its area and a compact status chip. */
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
  const days: Array<[string, FilingRow[]]> = [];
  for (const row of rows) {
    const d = row.dueDate.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last[0] === d) last[1].push(row);
    else days.push([d, [row]]);
  }
  return (
    <section className="surface px-4 pb-1.5 pt-3.5" aria-label="Coming up">
      <div className="mb-1 flex items-center gap-2 border-b border-line-soft pb-2">
        <h2 className="flex-1 text-[13px] font-medium text-ink">Coming up</h2>
        <span className="text-[11px] text-ink-muted">{rows.length}</span>
      </div>
      {days.length === 0 ? (
        <p className="py-3 text-[13px] text-ink-faint">None</p>
      ) : (
        days.map(([d, list]) => (
          <div key={d} className="flex items-center gap-2.5 border-t border-line-soft py-2.5 first:border-t-0">
            <DateTile iso={d} status={worstStatus(list.map((row) => filingStatus(row, now)))} className="h-10 w-10" />
            <ul className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
              {list.map((row) => (
                <li key={row.id} className="min-w-0">
                  <Link href={hrefOf(row)} className={cn('flex w-full min-w-0 items-center gap-2 text-left hover:text-brand-text')}>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {row.particular}
                      {showCompany ? <span className="font-normal text-ink-muted"> · {row.companyName}</span> : null}
                    </span>
                    <CompactChip word={filingWord(row, now)} />
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
