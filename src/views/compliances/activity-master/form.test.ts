import { describe, expect, it } from 'vitest';
import type { ActivityDto } from '@/views/compliances/tasks/api';
import { activityErrors, activityPatchBody, fromActivity, openPointState } from './form';

const base: ActivityDto = {
  id: 'ACT-001',
  name: 'GSTR-3B',
  kind: 'Statutory',
  group: 'statutory',
  frequency: 'Monthly',
  module: 'GST',
  area: 'gst',
  dueRule: '20th',
  penalty: '',
  applies: '',
  ownerRole: 'Lead',
  reviewerRole: 'Manager',
  notifyDays: 5,
  visibility: 'both',
  note: '',
  confirm: null,
  confirmedAt: null,
  from: 'master',
};

describe('activity master form', () => {
  it('sends nothing when nothing changed', () => {
    expect(activityPatchBody(base, fromActivity(base))).toEqual({});
  });

  it('sends only the changed fields, trimmed', () => {
    const f = { ...fromActivity(base), notifyDays: '7', ownerRole: '  Partner ' };
    expect(activityPatchBody(base, f)).toEqual({ notifyDays: 7, ownerRole: 'Partner' });
  });

  it('never sends a visibility change for a statutory row', () => {
    expect(activityPatchBody(base, { ...fromActivity(base), visibility: 'firm' })).toEqual({});
    const ns = { ...base, group: 'non-statutory' as const, visibility: 'firm' as const };
    expect(activityPatchBody(ns, { ...fromActivity(ns), visibility: 'client' })).toEqual({ visibility: 'client' });
  });

  it('sends the confirm flag only for a row with an open point', () => {
    expect(activityPatchBody(base, { ...fromActivity(base), confirmed: true })).toEqual({});
    const open = { ...base, confirm: 'Confirm the due day' };
    expect(activityPatchBody(open, { ...fromActivity(open), confirmed: true })).toEqual({ confirmed: true });
  });

  it('checks the notify days and the role lengths', () => {
    expect(activityErrors({ ...fromActivity(base), notifyDays: '121' }).notifyDays).toBeTruthy();
    expect(activityErrors({ ...fromActivity(base), notifyDays: '' }).notifyDays).toBeTruthy();
    expect(activityErrors({ ...fromActivity(base), notifyDays: '2.5' }).notifyDays).toBeTruthy();
    expect(activityErrors({ ...fromActivity(base), ownerRole: 'x'.repeat(121) }).ownerRole).toBeTruthy();
    expect(Object.values(activityErrors(fromActivity(base))).filter(Boolean)).toEqual([]);
  });

  it('reads the open point state', () => {
    expect(openPointState(base)).toBe('none');
    expect(openPointState({ confirm: 'x', confirmedAt: null })).toBe('open');
    expect(openPointState({ confirm: 'x', confirmedAt: '2026-10-30T00:00:00Z' })).toBe('confirmed');
  });
});
