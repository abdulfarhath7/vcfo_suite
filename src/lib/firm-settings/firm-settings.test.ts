import { describe, expect, it } from 'vitest';
import {
  describeChange,
  diffFirmSettings,
  FIRM_SETTINGS_DEFAULTS,
  firmSettingsPatchSchema,
  normalizePatch,
  reminderDaysLabel,
  workingDaysLabel,
} from '@/lib/firm-settings/firm-settings';

describe('firmSettingsPatchSchema', () => {
  it('accepts a partial patch and turns empty text into null', () => {
    const parsed = firmSettingsPatchSchema.parse({ firmName: '  SBC  ', supportPhone: '' });
    expect(parsed).toEqual({ firmName: 'SBC', supportPhone: null });
  });

  it('refuses unknown fields, bad days, bad dates, bad zones and bad emails', () => {
    expect(firmSettingsPatchSchema.safeParse({ logoObjectKey: 'x' }).success).toBe(false);
    expect(firmSettingsPatchSchema.safeParse({ workingDays: [0] }).success).toBe(false);
    expect(firmSettingsPatchSchema.safeParse({ workingDays: [] }).success).toBe(false);
    expect(firmSettingsPatchSchema.safeParse({ reminderDays: [61] }).success).toBe(false);
    expect(
      firmSettingsPatchSchema.safeParse({ holidays: [{ date: '2026-02-30', label: 'X' }] }).success,
    ).toBe(false);
    expect(firmSettingsPatchSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(firmSettingsPatchSchema.safeParse({ supportEmail: 'not-an-email' }).success).toBe(false);
    expect(firmSettingsPatchSchema.safeParse({ supportEmail: 'help@sbcllp.in' }).success).toBe(true);
  });
});

describe('normalizePatch', () => {
  it('sorts and de-duplicates days and holidays', () => {
    const out = normalizePatch({
      workingDays: [5, 1, 1, 3],
      reminderDays: [1, 7, 3, 7],
      holidays: [
        { date: '2026-11-08', label: 'Diwali' },
        { date: '2026-01-26', label: 'Republic Day' },
        { date: '2026-11-08', label: 'Diwali (office)' },
      ],
    });
    expect(out.workingDays).toEqual([1, 3, 5]);
    expect(out.reminderDays).toEqual([7, 3, 1]);
    expect(out.holidays).toEqual([
      { date: '2026-01-26', label: 'Republic Day' },
      { date: '2026-11-08', label: 'Diwali (office)' },
    ]);
  });
});

describe('diffFirmSettings', () => {
  it('lists only the fields that change, with old and new values', () => {
    const changes = diffFirmSettings(FIRM_SETTINGS_DEFAULTS, {
      firmName: 'SBC',
      reminderDays: [1, 3, 7],
      timezone: 'Asia/Kolkata',
    });
    expect(changes).toEqual([{ field: 'firmName', old: null, new: 'SBC' }]);
  });

  it('returns nothing when the patch matches what is stored', () => {
    expect(diffFirmSettings(FIRM_SETTINGS_DEFAULTS, { workingDays: [6, 5, 4, 3, 2, 1] })).toEqual([]);
  });
});

describe('labels', () => {
  it('reads working days as a range or a list', () => {
    expect(workingDaysLabel([1, 2, 3, 4, 5, 6])).toBe('Mon to Sat');
    expect(workingDaysLabel([1, 2, 3, 4, 5])).toBe('Mon to Fri');
    expect(workingDaysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(workingDaysLabel([])).toBe('None');
  });

  it('reads reminder days in plain words', () => {
    expect(reminderDaysLabel([1, 7, 3])).toBe('7, 3 and 1 days before');
    expect(reminderDaysLabel([1])).toBe('1 day before');
    expect(reminderDaysLabel([0])).toBe('On the due date');
    expect(reminderDaysLabel([])).toBe('Off');
  });

  it('describes a change for the audit trail', () => {
    expect(describeChange({ field: 'firmName', new: 'SBC' })).toBe('Firm name: SBC');
    expect(describeChange({ field: 'supportPhone', new: null })).toBe('Phone cleared');
    expect(describeChange({ field: 'logo', new: 'firm/logo-1' })).toBe('Logo uploaded');
  });
});
