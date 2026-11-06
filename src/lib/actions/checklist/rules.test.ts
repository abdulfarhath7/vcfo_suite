import { describe, expect, it } from 'vitest';
import { getActiveCatalogItems, getItem } from '@/data/checklist';
import { getClientResponseFields } from '@/lib/checklist/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { checkResponseRow, isEditableAnswer, isFileRow, responseActionsFor, type ResponseTarget } from './rules';

/** The screen's own rules for one row, as they fall on a client: only their own fields, only as the form takes them. */

function openAt(stepId: string, responses: Record<string, string> = {}) {
  const state: Record<string, ChecklistItemStateSlice> = {};
  for (const item of getActiveCatalogItems()) {
    if (item.id === stepId) break;
    state[item.id] = { status: 'completed', reviewStatus: 'accepted', responses: { sameFact: 'held on another step' } } as ChecklistItemStateSlice;
  }
  return { ...state, [stepId]: { responses } as ChecklistItemStateSlice };
}

const check = (target: ResponseTarget, value: string, extra: { isFile?: boolean; probe?: boolean; role?: 'client' | 'intern'; state?: ReturnType<typeof openAt> } = {}) =>
  checkResponseRow({ role: extra.role ?? 'client', target, value, state: extra.state ?? openAt(target.stepId), engagement: { ownershipType: 'indian' }, isFile: extra.isFile, probe: extra.probe });

const ownerOk = (result: ReturnType<typeof check>) => result.checks.find((c) => c.rule === 'owner')!.ok;

const entryFile = () => {
  const item = getItem('pre-15')!;
  const group = getClientResponseFields(item).find((f) => f.type === 'repeat' && f.entryFields?.some((e) => e.type === 'file'))!;
  return { group: group.id, field: group.entryFields!.find((e) => e.type === 'file')!.id, text: group.entryFields!.find((e) => e.type === 'text')!.id };
};
const inEntry = (fieldId: string, group: string): ResponseTarget => ({ engagementId: 'e', stepId: 'pre-15', fieldId, group, entryId: 'p1', newEntry: true });

describe('a client\'s row', () => {
  it('passes on a field the client fills', () => {
    const { group, text } = entryFile();
    expect(ownerOk(check(inEntry(text, group), 'Asha'))).toBe(true);
  });

  it('holds a field only the project lead fills, and says who does', () => {
    const result = check({ engagementId: 'e', stepId: 'pre-1', fieldId: 'nicCode' }, '62011');
    expect(ownerOk(result)).toBe(false);
    expect(result.checks.find((c) => c.rule === 'owner')!.message).toMatch(/Your project lead/);
    expect(ownerOk(check({ engagementId: 'e', stepId: 'pre-1', fieldId: 'nicCode' }, '62011', { role: 'intern' }))).toBe(true);
  });

  it('holds a step the firm prepares', () => {
    expect(ownerOk(check({ engagementId: 'e', stepId: 'pre-2', fieldId: 'anything' }, 'x'))).toBe(false);
  });

  it('never lets typed text answer a file field, so it cannot point one at a stored path', () => {
    const { group, field } = entryFile();
    expect(ownerOk(check(inEntry(field, group), 'another-company/board.pdf'))).toBe(false);
    expect(ownerOk(check(inEntry(field, group), 'board.pdf', { isFile: true }))).toBe(true);
  });

  it('never lets a file answer a text field, unless it is only asking', () => {
    const { group, text } = entryFile();
    expect(ownerOk(check(inEntry(text, group), 'a.pdf', { isFile: true }))).toBe(false);
    expect(ownerOk(check(inEntry(text, group), 'a.pdf', { isFile: true, probe: true }))).toBe(true);
  });

  it('holds a field not on the form, and the list of entries itself', () => {
    expect(ownerOk(check({ engagementId: 'e', stepId: 'pre-15', fieldId: 'noSuchField' }, 'x'))).toBe(false);
    expect(ownerOk(check({ engagementId: 'e', stepId: 'pre-15', fieldId: entryFile().group }, 'p1,p2'))).toBe(false);
  });

  it('shows a client no value from another step', () => {
    const { group, text } = entryFile();
    expect(check(inEntry(text, group), 'Asha').checks.some((c) => c.rule === 'other_step')).toBe(false);
  });
});

describe('the action names', () => {
  it('give a client their own pair, and everyone else the staff pair', () => {
    expect(responseActionsFor('client')).toEqual({ set: 'client-portal.setAnswer', attach: 'client-portal.attachFile' });
    expect(responseActionsFor('manager')).toEqual({ set: 'checklist.setResponse', attach: 'checklist.attachFile' });
  });

  it('let a typed answer be corrected on the card, and never a file', () => {
    expect(isEditableAnswer('client-portal.setAnswer')).toBe(true);
    expect(isEditableAnswer('client-portal.attachFile')).toBe(false);
    expect(isEditableAnswer('client-portal.sendMessage')).toBe(false);
    expect(isFileRow('client-portal.attachFile')).toBe(true);
    expect(isFileRow('checklist.setResponse')).toBe(false);
  });
});
