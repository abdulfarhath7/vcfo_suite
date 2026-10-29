import { describe, expect, it } from 'vitest';
import { isClockTime, quietHoursEnd, whatsappCategoryAllows, type WhatsAppGatePrefs } from './prefs-gate';

const base: WhatsAppGatePrefs = {
  whatsapp: { docs: true, steps: true, deadlines: true },
  quietHours: true,
  quietStart: '21:00',
  quietEnd: '08:00',
  tz: 'Asia/Kolkata',
};

/** 2026-10-29 at hh:mm India time (UTC+5:30). */
function ist(hh: number, mm = 0): Date {
  return new Date(Date.UTC(2026, 9, 29, hh, mm) - 330 * 60_000);
}

describe('whatsappCategoryAllows', () => {
  it('follows the category switch and treats unsaved as on', () => {
    expect(whatsappCategoryAllows(base, 'document_delivered')).toBe(true);
    expect(whatsappCategoryAllows({ ...base, whatsapp: { docs: false } }, 'document_delivered')).toBe(false);
    expect(whatsappCategoryAllows({ ...base, whatsapp: { deadlines: false } }, 'compliance_overdue')).toBe(false);
    expect(whatsappCategoryAllows({ ...base, whatsapp: { steps: false } }, 'coi_issued')).toBe(false);
    expect(whatsappCategoryAllows({ ...base, whatsapp: {} }, 'coi_issued')).toBe(true);
    expect(whatsappCategoryAllows(null, 'coi_issued')).toBe(true);
  });

  it('never mutes the welcome message', () => {
    expect(whatsappCategoryAllows({ ...base, whatsapp: { docs: false, steps: false, deadlines: false } }, 'welcome')).toBe(true);
  });
});

describe('quietHoursEnd', () => {
  it('is null outside the window or when quiet hours are off', () => {
    expect(quietHoursEnd(base, ist(12))).toBeNull();
    expect(quietHoursEnd(base, ist(8, 0))).toBeNull();
    expect(quietHoursEnd({ ...base, quietHours: false }, ist(23))).toBeNull();
    expect(quietHoursEnd({ ...base, quietStart: '09:00', quietEnd: '09:00' }, ist(9))).toBeNull();
    expect(quietHoursEnd(null, ist(23))).toBeNull();
  });

  it('finds the end of a window that crosses midnight', () => {
    expect(quietHoursEnd(base, ist(23, 15))?.toISOString()).toBe(new Date(ist(8).getTime() + 86_400_000).toISOString());
    expect(quietHoursEnd(base, ist(21, 0))).not.toBeNull();
    expect(quietHoursEnd(base, ist(6, 30))?.toISOString()).toBe(ist(8).toISOString());
  });

  it('handles a same-day window and another time zone', () => {
    const day = { ...base, quietStart: '13:00', quietEnd: '14:00' };
    expect(quietHoursEnd(day, ist(13, 30))?.toISOString()).toBe(ist(14).toISOString());
    expect(quietHoursEnd(day, ist(14, 0))).toBeNull();
    const london = { ...base, tz: 'Europe/London' };
    // 12:00 IST on 29 Oct is 06:30 in London (GMT after the clock change), inside 21:00 to 08:00.
    expect(quietHoursEnd(london, ist(12))).not.toBeNull();
  });

  it('checks clock strings', () => {
    expect(isClockTime('08:00')).toBe(true);
    expect(isClockTime('23:59')).toBe(true);
    expect(isClockTime('24:00')).toBe(false);
    expect(isClockTime('8:00')).toBe(false);
  });
});
