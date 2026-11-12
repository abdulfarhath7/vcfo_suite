import { describe, expect, it } from 'vitest';
import { canRecordRegistrationTracker, isRegistrationTracker, trackerChecklistMirror } from './tracker-access';

describe('canRecordRegistrationTracker', () => {
  it('lets the project lead and the client record', () => {
    expect(canRecordRegistrationTracker('intern')).toBe(true);
    expect(canRecordRegistrationTracker('client')).toBe(true);
  });

  it('keeps the manager, the admin and the super admin to reading', () => {
    for (const role of ['manager', 'admin', 'super_admin', 'developer', 'partner', null, undefined]) {
      expect(canRecordRegistrationTracker(role)).toBe(false);
    }
  });
});

describe('isRegistrationTracker', () => {
  it('matches the GST and LUT registrations only', () => {
    expect(isRegistrationTracker('registration', 'reg-4')).toBe(true);
    expect(isRegistrationTracker('registration', 'reg-5')).toBe(true);
    expect(isRegistrationTracker('registration', 'reg-6')).toBe(false);
    expect(isRegistrationTracker('obligation', 'reg-4')).toBe(false);
  });
});

describe('trackerChecklistMirror', () => {
  it('copies the GSTIN and the date of registration', () => {
    expect(trackerChecklistMirror('reg-4', { number: ' 29AAKCA4821M1Z5 ', 'registered-on': '2026-11-25', outcome: 'approved' })).toEqual({
      gstinNumber: '29AAKCA4821M1Z5',
      gstRegistrationDate: '2026-11-25',
    });
  });

  it('copies the LUT filing date and number, and clears on an empty value', () => {
    expect(trackerChecklistMirror('reg-5', { 'filed-on': '2026-11-18', arn: null })).toEqual({ lutFilingDate: '2026-11-18', lutArn: '' });
  });

  it('copies nothing for other fields or other steps', () => {
    expect(trackerChecklistMirror('reg-4', { arn: 'AA2911260123456' })).toBeNull();
    expect(trackerChecklistMirror('reg-6', { number: 'X' })).toBeNull();
  });
});
