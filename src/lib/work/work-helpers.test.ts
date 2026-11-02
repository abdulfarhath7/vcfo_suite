import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, sessionMs, totalSessionMs } from '@/lib/work/sessions';
import { isSameIdSet, moveInOrder } from '@/lib/work/checklist-order';
import { isWindowRequestStatus, resolveRequestedWindow, windowKindOf } from '@/lib/work/window-requests';
import { activityMatchesItem, auditEventMatchesItem, mergeActivity } from '@/lib/work/item-activity';
import { filingInstanceIdMap, workItemKeyFor } from '@/lib/work/work-item-key';
import { canRequestWindowChange, canUseWorkTools } from '@/lib/work/work-access';

describe('sessions', () => {
  const now = Date.parse('2026-10-29T10:00:00.000Z');
  it('counts a running session up to now', () => {
    expect(sessionMs({ startedAt: '2026-10-29T09:30:00.000Z', endedAt: null }, now)).toBe(30 * 60_000);
    expect(
      totalSessionMs(
        [
          { startedAt: '2026-10-29T09:30:00.000Z', endedAt: null },
          { startedAt: '2026-10-28T09:00:00.000Z', endedAt: '2026-10-28T10:15:00.000Z' },
        ],
        now,
      ),
    ).toBe(105 * 60_000);
  });
  it('never goes negative on bad input', () => {
    expect(sessionMs({ startedAt: 'x', endedAt: null }, now)).toBe(0);
    expect(sessionMs({ startedAt: '2026-10-29T11:00:00.000Z', endedAt: '2026-10-29T10:00:00.000Z' }, now)).toBe(0);
  });
  it('formats a clock and a duration', () => {
    expect(formatClock(3_909_000)).toBe('1:05:09');
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(125 * 60_000)).toBe('2 h 5 min');
    expect(formatDuration(120 * 60_000)).toBe('2 h');
  });
});

describe('checklist order', () => {
  it('moves an id up and down and ignores edges', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveInOrder(['a', 'b'], 'z', 1)).toEqual(['a', 'b']);
  });
  it('checks an order holds exactly the same ids', () => {
    expect(isSameIdSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(isSameIdSet(['a', 'b'], ['a', 'a'])).toBe(false);
    expect(isSameIdSet(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(isSameIdSet(['a', 'b'], ['a'])).toBe(false);
  });
});

describe('window requests', () => {
  const current = { from: '2026-10-20', to: '2026-10-25' };
  it('keeps the current start when only a new end is asked for', () => {
    expect(resolveRequestedWindow(current, { to: '2026-10-30' })).toEqual({ from: '2026-10-20', to: '2026-10-30' });
  });
  it('pulls the start back when the new end is before it', () => {
    expect(resolveRequestedWindow(current, { to: '2026-10-18' })).toEqual({ from: '2026-10-18', to: '2026-10-18' });
  });
  it('refuses an asked start after the asked end, or a bad date', () => {
    expect(resolveRequestedWindow(current, { from: '2026-10-31', to: '2026-10-30' })).toBeNull();
    expect(resolveRequestedWindow(current, { to: '30 Oct' })).toBeNull();
  });
  it('knows the statuses and the item kinds with windows', () => {
    expect(isWindowRequestStatus('pending')).toBe(true);
    expect(isWindowRequestStatus('done')).toBe(false);
    expect(windowKindOf('step:e:pre-1')).toBe('step');
    expect(windowKindOf('filing:x')).toBe('filing');
    expect(windowKindOf('request:x')).toBeNull();
  });
});

describe('item activity', () => {
  const step = { kind: 'step' as const, engagementId: 'e', stepId: 'pre-1' };
  it('matches audit metadata for the item', () => {
    expect(auditEventMatchesItem({ itemId: 'pre-1' }, step, 'step:e:pre-1')).toBe(true);
    expect(auditEventMatchesItem({ target: { kind: 'step', itemId: 'pre-1' } }, step, 'step:e:pre-1')).toBe(true);
    expect(auditEventMatchesItem({ itemKey: 'step:e:pre-1' }, step, 'step:e:pre-1')).toBe(true);
    expect(auditEventMatchesItem({ itemId: 'pre-3' }, step, 'step:e:pre-1')).toBe(false);
    expect(auditEventMatchesItem({ instanceId: 'f1' }, { kind: 'filing', id: 'f1' }, 'filing:f1')).toBe(true);
    expect(auditEventMatchesItem({ requestId: 'r1' }, { kind: 'request', id: 'r1' }, 'request:r1')).toBe(true);
    expect(auditEventMatchesItem({ requestId: 'r2' }, { kind: 'request', id: 'r1' }, 'request:r1')).toBe(false);
    expect(auditEventMatchesItem(null, step, 'step:e:pre-1')).toBe(false);
  });
  it('matches activity rows on the item label only', () => {
    expect(activityMatchesItem('Company name approval', ['company name approval'])).toBe(true);
    expect(activityMatchesItem('Other step', ['Company name approval'])).toBe(false);
    expect(activityMatchesItem('', ['x'])).toBe(false);
  });
  it('sorts newest first and caps the list', () => {
    const e = (id: string, at: string) => ({ id, at, who: 'A', text: 't', source: 'audit' as const });
    expect(mergeActivity([e('a', '2026-10-01'), e('b', '2026-10-03'), e('c', '2026-10-02')], 2).map((x) => x.id)).toEqual([
      'b',
      'c',
    ]);
  });
});

describe('work item keys', () => {
  it('keys steps with the database engagement id', () => {
    expect(workItemKeyFor({ source: 'step', engagementId: 'e1', catalogId: 'pre-1' })).toBe(
      'step:11111111-1111-1111-1111-111111111101:pre-1',
    );
  });
  it('keys requests and filings, and gives null for a filing with no register row', () => {
    expect(workItemKeyFor({ source: 'request', engagementId: 'x', requestId: 'r1' })).toBe('request:r1');
    expect(workItemKeyFor({ source: 'task', engagementId: 'x', taskId: 't1' })).toBe('task:t1');
    const map = filingInstanceIdMap([
      { id: 'inst-1', engagementId: 'x', obligationId: 'gstr3b', dueDate: '2026-10-20', periodLabel: 'Sep 2026' },
    ]);
    expect(workItemKeyFor({ source: 'filing', engagementId: 'x', filingId: 'x:gstr3b:2026-10-20:Sep 2026' }, map)).toBe(
      'filing:inst-1',
    );
    expect(workItemKeyFor({ source: 'filing', engagementId: 'x', filingId: 'x:other:2026-10-20:' }, map)).toBeNull();
  });
});

describe('work access', () => {
  it('lets staff use the work tools and only leads request a date change', () => {
    for (const role of ['intern', 'manager', 'admin', 'super_admin']) expect(canUseWorkTools(role)).toBe(true);
    for (const role of ['client', 'developer', undefined]) expect(canUseWorkTools(role)).toBe(false);
    expect(canRequestWindowChange('intern')).toBe(true);
    expect(canRequestWindowChange('manager')).toBe(false);
  });
});
