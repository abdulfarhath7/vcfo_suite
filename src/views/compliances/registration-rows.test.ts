import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import {
  parseRegistrationKey,
  regDateLabel,
  regDueSoon,
  regFlow,
  registrationKey,
  registrationRows,
  workbookRowKey,
} from '@/views/compliances/registration-rows';

const NOW = new Date('2026-10-16T09:00:00Z');

function engagement(patch: Partial<Engagement> = {}): Engagement {
  return {
    id: 'eng-1',
    clientId: 'c-1',
    companyName: 'Acme Pvt Ltd',
    companyType: 'domestic',
    internId: 'lead-1',
    adminId: 'admin',
    createdAt: '2026-01-05',
    stage: 'Post-Incorporation',
    health: 'on-track',
    incorporationDate: '2026-10-05',
    ...patch,
  } as Engagement;
}

function rowsFor(state: Record<string, Partial<ChecklistItemStateSlice>>, patch: Partial<Engagement> = {}) {
  return registrationRows([engagement(patch)], () => state as Record<string, ChecklistItemStateSlice>, NOW);
}

describe('registrationRows', () => {
  it('lists every registration-phase step for each engagement, GST first', () => {
    const rows = rowsFor({});
    expect(rows.length).toBe(23);
    expect(rows[0]?.item.id).toBe('reg-4');
    expect(rows[0]?.name).toBe('GST Registration');
    expect(rows[0]?.category).toBe('Tax');
    expect(rows[0]?.authority).toBe('GSTN');
    expect(rows[0]?.key).toBe('eng-1~reg-4');
    // The legacy PAN and TAN row is not part of the phase.
    expect(rows.some((r) => r.item.id === 'reg-2')).toBe(false);
  });

  it('reads the six words from the step state and the checklist deadline rule', () => {
    const rows = rowsFor({
      'reg-1': { status: 'completed', completedOn: '2026-10-10' },
      'reg-3': { status: 'awaiting-client' },
      'reg-7': { status: 'in-progress', workflowStage: 'approval' },
      'reg-9': { status: 'not-applicable' },
    });
    const by = (id: string) => rows.find((r) => r.item.id === id)!;
    // GST is due two weeks after incorporation (19 Oct): three days away.
    expect(by('reg-4').dueDate).toBe('2026-10-19');
    expect(by('reg-4').word).toBe('Due soon');
    expect(by('reg-4').owner).toBe('sbc');
    expect(by('reg-1').word).toBe('Done');
    expect(by('reg-1').owner).toBeNull();
    expect(by('reg-3').word).toBe('Waiting');
    expect(by('reg-3').owner).toBe('client');
    expect(by('reg-7').word).toBe('In progress');
    expect(by('reg-7').owner).toBe('mca');
    expect(by('reg-9').word).toBe('Not needed');
    expect(by('reg-15').word).toBe('Not started');
  });

  it('marks a step overdue once its own deadline has passed', () => {
    const rows = rowsFor({}, { incorporationDate: '2026-09-01' });
    expect(rows.find((r) => r.item.id === 'reg-4')?.word).toBe('Overdue');
    expect(regDateLabel(rows.find((r) => r.item.id === 'reg-4')!, NOW).text).toBe('31d late');
  });

  it('prefers the manager window over the rule for the due date', () => {
    const rows = rowsFor(
      {},
      { schedule: { steps: { 'reg-15': { from: '2026-10-20', to: '2026-10-28', setBy: 'm', setAt: '2026-10-01' } } } },
    );
    const msme = rows.find((r) => r.item.id === 'reg-15')!;
    expect(msme.dueDate).toBe('2026-10-28');
    expect(msme.window).toEqual({ from: '2026-10-20', to: '2026-10-28' });
    expect(regDueSoon(msme, NOW)).toBe(true);
  });

  it('shows a number only when the answers hold one', () => {
    const rows = rowsFor({ 'reg-4': { status: 'completed', responses: { gstRegistrationDate: '2026-10-12' } } });
    const gst = rows.find((r) => r.item.id === 'reg-4')!;
    expect(gst.number).toBeUndefined();
    expect(gst.registrationDate).toBe('2026-10-12');
  });

  it('counts the progress flow by workflow stage', () => {
    const rows = rowsFor({
      'reg-1': { status: 'completed' },
      'reg-3': { status: 'in-progress', workflowStage: 'collection' },
      'reg-7': { status: 'in-progress', workflowStage: 'filing' },
      'reg-6': { status: 'in-progress', workflowStage: 'approval' },
    });
    expect(regFlow(rows)).toEqual({ documents: 1, application: 1, review: 1, granted: 1 });
  });
});

describe('record keys', () => {
  it('round-trips an engagement id with dashes', () => {
    const key = registrationKey('2b1f-44aa-9c', 'reg-4');
    expect(parseRegistrationKey(key)).toEqual({ engagementId: '2b1f-44aa-9c', itemId: 'reg-4' });
    expect(parseRegistrationKey('nothing')).toBeNull();
  });

  it('finds the credentials workbook row by the shared title', () => {
    expect(workbookRowKey({ title: 'GST Registration' })).toBe('gst');
    expect(workbookRowKey({ title: 'Shops & Establishment' })).toBe('se');
    expect(workbookRowKey({ title: 'ODI Reporting' })).toBeUndefined();
  });
});
