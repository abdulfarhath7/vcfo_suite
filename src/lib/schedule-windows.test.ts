import { describe, expect, it } from 'vitest';
import {
  applyScheduleWindow,
  canSetScheduleWindows,
  formatWindow,
  isIncorporationWindowStep,
  isValidWindowRange,
  normalizeEngagementSchedule,
  windowForStep,
} from '@/lib/schedule-windows';

const meta = { setBy: 'mgr-1', now: '2026-09-15T10:00:00.000Z' };

describe('schedule windows', () => {
  it('only managers, admins and super admins may write', () => {
    expect(canSetScheduleWindows('manager')).toBe(true);
    expect(canSetScheduleWindows('admin')).toBe(true);
    expect(canSetScheduleWindows('super_admin')).toBe(true);
    expect(canSetScheduleWindows('intern')).toBe(false);
    expect(canSetScheduleWindows('client')).toBe(false);
    expect(canSetScheduleWindows(undefined)).toBe(false);
  });

  it('validates the range and drops malformed windows on read', () => {
    expect(isValidWindowRange('2026-09-10', '2026-09-17')).toBe(true);
    expect(isValidWindowRange('2026-09-17', '2026-09-10')).toBe(false);
    expect(isValidWindowRange('10/09/2026', '2026-09-17')).toBe(false);
    expect(
      normalizeEngagementSchedule({
        incorporation: { from: '2026-09-10', to: '2026-09-17', setBy: 'm', setAt: 't' },
        steps: { 'reg-4': { from: 'bad', to: '2026-10-01' }, 'reg-1': { from: '2026-10-01', to: '2026-10-05' } },
      }),
    ).toEqual({
      incorporation: { from: '2026-09-10', to: '2026-09-17', setBy: 'm', setAt: 't' },
      steps: { 'reg-1': { from: '2026-10-01', to: '2026-10-05', setBy: '', setAt: '' } },
    });
    expect(normalizeEngagementSchedule(null)).toEqual({});
  });

  it('one incorporation window covers every SPICe+ Part A and Part B step', () => {
    const schedule = applyScheduleWindow({}, { kind: 'incorporation' }, { from: '2026-09-10', to: '2026-09-17' }, meta);
    expect(isIncorporationWindowStep('pre-1')).toBe(true);
    expect(isIncorporationWindowStep('pre-12')).toBe(true);
    expect(isIncorporationWindowStep('reg-4')).toBe(false);
    expect(windowForStep(schedule, 'pre-1')?.to).toBe('2026-09-17');
    expect(windowForStep(schedule, 'pre-12')?.to).toBe('2026-09-17');
    expect(windowForStep(schedule, 'reg-4')).toBeUndefined();
  });

  it('sets, replaces and clears per-step windows without touching the others', () => {
    let schedule = applyScheduleWindow({}, { kind: 'step', itemId: 'reg-4' }, { from: '2026-10-01', to: '2026-10-05' }, meta);
    schedule = applyScheduleWindow(schedule, { kind: 'step', itemId: 'reg-1' }, { from: '2026-10-06', to: '2026-10-08' }, meta);
    expect(windowForStep(schedule, 'reg-4')?.setBy).toBe('mgr-1');
    schedule = applyScheduleWindow(schedule, { kind: 'step', itemId: 'reg-4' }, null, meta);
    expect(windowForStep(schedule, 'reg-4')).toBeUndefined();
    expect(windowForStep(schedule, 'reg-1')?.from).toBe('2026-10-06');
    schedule = applyScheduleWindow(schedule, { kind: 'step', itemId: 'reg-1' }, null, meta);
    expect(schedule).toEqual({});
  });

  it('formats the window with the year once', () => {
    expect(formatWindow({ from: '2026-09-10', to: '2026-09-17' })).toBe('10 Sept – 17 Sept 2026');
    expect(formatWindow({ from: '2026-09-17', to: '2026-09-17' })).toBe('17 Sept 2026');
  });
});
