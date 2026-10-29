import { z } from 'zod';

/**
 * FIRM SETTINGS — pure shapes, defaults, input schema and the change list (G-02).
 *
 * The store is the one-row `firm_settings` table (`src/db/schema-firm.ts`). This module has no
 * `db`, `server-only` or React import, so the repository, the route and the screen share it and
 * every rule here is unit-tested.
 */

export interface FirmHoliday {
  /** YYYY-MM-DD. */
  date: string;
  label: string;
}

export interface FirmSettings {
  firmName: string | null;
  /** True when a logo has been uploaded; the bytes stream from `/api/firm-settings/logo`. */
  hasLogo: boolean;
  /** ISO weekday numbers, 1 = Monday to 7 = Sunday, ascending. */
  workingDays: number[];
  /** Sorted by date, one per date. */
  holidays: FirmHoliday[];
  /** Days before a due date when the default reminders go out, largest first. */
  reminderDays: number[];
  timezone: string;
  supportEmail: string | null;
  supportPhone: string | null;
  address: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

export const FIRM_SETTINGS_DEFAULTS: FirmSettings = {
  firmName: null,
  hasLogo: false,
  workingDays: [1, 2, 3, 4, 5, 6],
  holidays: [],
  reminderDays: [7, 3, 1],
  timezone: 'Asia/Kolkata',
  supportEmail: null,
  supportPhone: null,
  address: null,
  updatedAt: null,
  updatedByName: null,
};

/** The fields a person may change through PATCH. The logo has its own route. */
export type FirmSettingsField =
  | 'firmName'
  | 'workingDays'
  | 'holidays'
  | 'reminderDays'
  | 'timezone'
  | 'supportEmail'
  | 'supportPhone'
  | 'address';

export const FIRM_SETTINGS_FIELD_LABEL: Record<FirmSettingsField | 'logo', string> = {
  firmName: 'Firm name',
  logo: 'Logo',
  workingDays: 'Working days',
  holidays: 'Holidays',
  reminderDays: 'Default reminders',
  timezone: 'Timezone',
  supportEmail: 'Support email',
  supportPhone: 'Phone',
  address: 'Address',
};

/** The longest reminder lead the screen offers; a filing a quarter away needs no nudge yet. */
export const MAX_REMINDER_DAYS = 60;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(value: string): boolean {
  if (!YMD.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** True when the runtime knows this IANA zone name. */
export function isKnownTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Empty text means "clear it". */
const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((v) => (v === null || v === '' ? null : v));

export const firmSettingsPatchSchema = z
  .object({
    firmName: optionalText(160),
    workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    holidays: z
      .array(
        z.object({
          date: z.string().refine(isRealDay, 'Holiday dates are YYYY-MM-DD'),
          label: z.string().trim().min(1, 'Name each holiday').max(80),
        }),
      )
      .max(120),
    reminderDays: z.array(z.number().int().min(0).max(MAX_REMINDER_DAYS)).max(6),
    timezone: z.string().trim().min(1).max(64).refine(isKnownTimezone, 'Unknown timezone'),
    supportEmail: z
      .union([z.string().trim().max(200), z.null()])
      .transform((v) => (v === null || v === '' ? null : v))
      .refine((v) => v === null || z.string().email().safeParse(v).success, 'Enter a valid email'),
    supportPhone: optionalText(40),
    address: optionalText(500),
  })
  .partial()
  .strict();

export type FirmSettingsPatch = z.infer<typeof firmSettingsPatchSchema>;

/** One value per field in a stable order, so equal settings compare equal. */
export function normalizePatch(patch: FirmSettingsPatch): FirmSettingsPatch {
  const out: FirmSettingsPatch = { ...patch };
  if (patch.workingDays) out.workingDays = [...new Set(patch.workingDays)].sort((a, b) => a - b);
  if (patch.reminderDays) out.reminderDays = [...new Set(patch.reminderDays)].sort((a, b) => b - a);
  if (patch.holidays) {
    const byDate = new Map<string, FirmHoliday>();
    for (const h of patch.holidays) byDate.set(h.date, { date: h.date, label: h.label.trim() });
    out.holidays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

export interface FirmSettingsChange {
  field: FirmSettingsField;
  old: unknown;
  new: unknown;
}

/** The fields whose value actually changes, with the old and the new value (for the audit trail). */
export function diffFirmSettings(before: FirmSettings, patch: FirmSettingsPatch): FirmSettingsChange[] {
  const changes: FirmSettingsChange[] = [];
  const next = normalizePatch(patch);
  for (const field of Object.keys(next) as FirmSettingsField[]) {
    const value = next[field];
    if (value === undefined) continue;
    const old = before[field];
    if (JSON.stringify(old) === JSON.stringify(value)) continue;
    changes.push({ field, old, new: value });
  }
  return changes;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Mon to Sat", "Mon to Fri", or a list such as "Mon, Wed, Fri". */
export function workingDaysLabel(days: number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return 'None';
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous && sorted.length >= 3) {
    return `${WEEKDAY_SHORT[sorted[0]! - 1]} to ${WEEKDAY_SHORT[sorted.at(-1)! - 1]}`;
  }
  return sorted.map((d) => WEEKDAY_SHORT[d - 1]).join(', ');
}

export const WEEKDAYS: Array<{ day: number; short: string }> = WEEKDAY_SHORT.map((short, i) => ({
  day: i + 1,
  short,
}));

/** "7, 3 and 1 day before"; "On the due date" for 0 alone. */
export function reminderDaysLabel(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => b - a);
  if (sorted.length === 0) return 'Off';
  if (sorted.length === 1 && sorted[0] === 0) return 'On the due date';
  const words = sorted.map(String);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
  const last = sorted.at(-1);
  return `${list} ${sorted.length === 1 && last === 1 ? 'day' : 'days'} before`;
}

/** A short line for the audit trail and the settings history. */
export function describeChange(change: { field: FirmSettingsField | 'logo'; new: unknown }): string {
  const label = FIRM_SETTINGS_FIELD_LABEL[change.field];
  const value = change.new;
  if (change.field === 'logo') return value ? 'Logo uploaded' : 'Logo removed';
  if (change.field === 'workingDays' && Array.isArray(value)) {
    return `${label}: ${workingDaysLabel(value as number[])}`;
  }
  if (change.field === 'reminderDays' && Array.isArray(value)) {
    return `${label}: ${reminderDaysLabel(value as number[])}`;
  }
  if (change.field === 'holidays' && Array.isArray(value)) {
    return `${label}: ${value.length} listed`;
  }
  if (value === null || value === '') return `${label} cleared`;
  return `${label}: ${String(value)}`;
}
