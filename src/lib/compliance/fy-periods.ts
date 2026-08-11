import type { FyPeriod } from '@/lib/compliance/types';

function parseIso(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

function fyLabelForEnd(end: Date): string {
  const endYear = end.getFullYear();
  const startYear = endYear - 1;
  const shortEnd = String(endYear).slice(-2);
  return `FY ${startYear}-${shortEnd}`;
}

/** March 31 FY end for the first period starting at `start`. */
function firstFyEnd(start: Date): Date {
  const year = start.getMonth() < 3 ? start.getFullYear() : start.getFullYear() + 1;
  return new Date(year, 2, 31);
}

function nextFullFyStart(prevEnd: Date): Date {
  return new Date(prevEnd.getFullYear(), 3, 1);
}

function fullFyEnd(start: Date): Date {
  return new Date(start.getFullYear() + 1, 2, 31);
}

/**
 * Indian FY periods for an engagement.
 * First period may be a short FY (incorporation date → 31 March).
 */
export function getFyPeriods(incorporationDateIso: string, throughDate: Date): FyPeriod[] {
  const inc = parseIso(incorporationDateIso);
  const periods: FyPeriod[] = [];

  let start = inc;
  let end = firstFyEnd(inc);
  const incIsFullFyStart = inc.getMonth() === 3 && inc.getDate() === 1;

  periods.push({
    label: fyLabelForEnd(end),
    short: !incIsFullFyStart,
    start,
    end,
  });

  while (end < throughDate) {
    start = nextFullFyStart(end);
    end = fullFyEnd(start);
    periods.push({
      label: fyLabelForEnd(end),
      short: false,
      start,
      end,
    });
  }

  return periods;
}

export function defaultAgmDateForFy(fyEnd: Date): Date {
  return new Date(fyEnd.getFullYear(), 8, 30);
}

export { parseIso };

export function toIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
