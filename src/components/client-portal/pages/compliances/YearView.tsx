'use client';

/** Year view (prototype CalendarScreen YearView): twelve month cards of the FY; this month has a navy inner ring. */
import {
  MON,
  byDate,
  countByStatus,
  worstStatus,
  type CompStatus,
  type PortalFiling,
} from '@/lib/client-portal/compliances';

/** Status colours (R-25, prototype YearView): a day with filings is a solid mid-colour fill with light text. */
const TINT: Record<CompStatus, [string, string]> = {
  ok: ['oklch(var(--positive-mid))', 'oklch(var(--surface-raised))'],
  due: ['oklch(var(--warning-mid))', 'oklch(var(--surface-raised))'],
  over: ['oklch(var(--danger-mid))', 'oklch(var(--surface-raised))'],
  up: ['oklch(var(--upcoming-mid))', 'oklch(var(--surface-raised))'],
};
const DOT: Record<CompStatus, string> = { ok: 'var(--ok-mid)', due: 'var(--due-mid)', over: 'var(--over-mid)', up: 'oklch(var(--upcoming-mid))' };
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function YearView({ months, rows, today, onMonth }: { months: string[]; rows: PortalFiling[]; today: string; onMonth: (key: string) => void }) {
  const dates = byDate(rows);
  return (
    <div className="yv">
      {months.map((key) => {
        const [y, m] = key.split('-').map(Number) as [number, number];
        const mr = rows.filter((r) => r.dueDate.startsWith(key));
        const c = countByStatus(mr, today);
        const first = new Date(Date.UTC(y, m - 1, 1));
        const start = (first.getUTCDay() + 6) % 7;
        const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const cells: React.ReactNode[] = [];
        for (let i = 0; i < start; i++) cells.push(<span key={`b${i}`} />);
        for (let d = 1; d <= days; d++) {
          const di = `${key}-${String(d).padStart(2, '0')}`;
          const it = dates.get(di) ?? [];
          const w = it.length ? worstStatus(it, today) : null;
          const tip = w
            ? `${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MON[m - 1]} · ${it
                .map((r) => r.name)
                .slice(0, 3)
                .join(', ')}${it.length > 3 ? ` +${it.length - 3}` : ''}`
            : undefined;
          cells.push(
            <span key={d} className={`${w ? 'f' : ''}${di === today ? ' t' : ''}`} style={w ? { background: TINT[w][0], color: TINT[w][1] } : undefined} data-tip={tip}>
              {d}
            </span>,
          );
        }
        for (let q = (start + days) % 7; q && q < 7; q++) cells.push(<span key={`a${q}`} />);
        const sum = (['over', 'due', 'ok', 'up'] as CompStatus[]).filter((s) => c[s]);
        return (
          <button
            key={key}
            type="button"
            className={`ym${key === today.slice(0, 7) ? ' now' : ''}`}
            data-month={key}
            aria-label={`${MON[m - 1]} ${y} · ${mr.length} filings · open the month`}
            data-notip=""
            onClick={() => onMonth(key)}
          >
            <div className="ym-h">
              <b>
                {MON[m - 1]} {y}
              </b>
              <span className="n">{mr.length}</span>
            </div>
            <div className="ym-g">{cells}</div>
            <div className="ym-s">
              {sum.length ? (
                sum.map((s) => (
                  <span key={s}>
                    <i style={{ background: DOT[s], borderRadius: 2 }} />
                    {c[s]}
                  </span>
                ))
              ) : (
                <span>Nothing due</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

