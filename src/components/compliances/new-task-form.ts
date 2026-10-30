import type { NewTaskForm } from '@/components/compliances/NewTaskDialog';

/** Pure parts of the New task form (S-5): the plain date field and the checks. */

export const OTHER_ACTIVITY = 'other';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = MON.map((m) => m.toLowerCase());

/** "2026-10-16" to "16 Oct 2026" (R-29). */
export function plainFull(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** "16 Oct 2026", "16 october" (this year) or "16/10/2026" to "2026-10-16". */
export function parsePlain(t: string, year: number): string | undefined {
  const m = t.trim().match(/^(\d{1,2})[\s/-]+([a-z]{3,}|\d{1,2})[\s/-]*(\d{4})?$/i);
  if (!m) return undefined;
  const mi = /^\d+$/.test(m[2]!) ? Number(m[2]) - 1 : MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase());
  if (mi < 0 || mi > 11) return undefined;
  const y = m[3] ? Number(m[3]) : year;
  const dt = new Date(Date.UTC(y, mi, Number(m[1])));
  if (dt.getUTCMonth() !== mi) return undefined;
  return dt.toISOString().slice(0, 10);
}

export type NewTaskErrors = Partial<Record<'act' | 'name' | 'client' | 'start' | 'end' | 'owner' | 'notify', string>>;

/** The checks of the form, pure so a test can call them. */
export function newTaskErrors(f: Pick<NewTaskForm, 'act' | 'name' | 'client' | 'start' | 'end' | 'owner' | 'notify'>): NewTaskErrors {
  const n = Number(f.notify);
  const err: NewTaskErrors = {
    act: !f.act ? 'Pick an activity' : undefined,
    name: f.act === OTHER_ACTIVITY && !f.name.trim() ? 'Give the task a name' : undefined,
    client: !f.client ? 'Pick a client' : undefined,
    start: !f.start ? 'Pick a start date' : undefined,
    end: !f.end ? 'Pick an end date' : f.start && f.end < f.start ? 'End on or after the start' : undefined,
    owner: !f.owner ? 'Pick an owner' : undefined,
    notify: f.notify.trim() === '' || !Number.isInteger(n) || n < 0 || n > 60 ? 'Use 0 to 60 days' : undefined,
  };
  return err;
}

