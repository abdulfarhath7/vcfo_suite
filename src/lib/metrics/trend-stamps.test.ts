import { describe, expect, it } from 'vitest';
import { requestClosedPatch, taskCompletionPatch } from './trend-stamps';

const NOW = new Date('2026-10-29T06:00:00Z');

describe('taskCompletionPatch', () => {
  it('stamps the time when a task moves to done', () => {
    expect(taskCompletionPatch('open', 'done', NOW)).toEqual({ completedAt: NOW });
    expect(taskCompletionPatch(null, 'done', NOW)).toEqual({ completedAt: NOW });
  });

  it('clears it when the task reopens', () => {
    expect(taskCompletionPatch('done', 'open', NOW)).toEqual({ completedAt: null });
  });

  it('leaves it alone when the status does not cross the line', () => {
    expect(taskCompletionPatch('done', 'done', NOW)).toEqual({});
    expect(taskCompletionPatch('open', 'in-progress', NOW)).toEqual({});
    expect(taskCompletionPatch('done', undefined, NOW)).toEqual({});
  });
});

describe('requestClosedPatch', () => {
  it('stamps the time when a request is fulfilled, approved or cancelled', () => {
    expect(requestClosedPatch('pending', 'fulfilled', NOW)).toEqual({ closedAt: NOW });
    expect(requestClosedPatch('pending', 'cancelled', NOW)).toEqual({ closedAt: NOW });
    expect(requestClosedPatch('pending', 'approved', NOW)).toEqual({ closedAt: NOW });
  });

  it('clears it when the request opens again', () => {
    expect(requestClosedPatch('fulfilled', 'pending', NOW)).toEqual({ closedAt: null });
  });

  it('keeps the first close time between closed states', () => {
    expect(requestClosedPatch('fulfilled', 'approved', NOW)).toEqual({});
    expect(requestClosedPatch('pending', undefined, NOW)).toEqual({});
  });
});
