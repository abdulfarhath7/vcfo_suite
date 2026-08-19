import { describe, expect, it } from 'vitest';
import {
  coerceRegistrationWorkflowStage,
  REGISTRATION_WORKFLOW_STAGES,
  registrationWorkflowShortLabel,
} from '@/lib/registration-workflow';
import { coerceStatusCode, getPhaseItems, getPostIncPhases, getRegistrationPhases } from '@/data/checklist';

describe('sheet alignment helpers', () => {
  it('orders post-inc to master sheet sequence', () => {
    expect(getPhaseItems(getPostIncPhases()).map((i) => i.id)).toEqual([
      'post-1',
      'post-9',
      'post-3',
      'post-4',
      'post-5',
      'post-6',
      'post-2',
      'post-7',
      'post-8',
      'post-11',
      'post-10',
    ]);
  });

  it('shows registrations matching the master list (no PAN/TAN)', () => {
    const items = getPhaseItems(getRegistrationPhases());
    const ids = items.map((i) => i.id);
    expect(ids).toEqual([
      'reg-4',
      'reg-1',
      'reg-3',
      'reg-7',
      'reg-6',
      'reg-15',
      'reg-16',
      'reg-8',
      'reg-5',
      'reg-11',
      'reg-9',
      'reg-13',
      'reg-14',
      'reg-10',
      'reg-12',
      'reg-17',
      'reg-18',
      'reg-19',
      'reg-20',
      'reg-21',
      'reg-22',
      'reg-23',
      'reg-24',
    ]);
    expect(ids).not.toContain('reg-2');
    expect(items[0]!.title).toBe('GST Registration');
    expect(items.find((item) => item.id === 'reg-5')!.title).toBe('LUT Filing');
  });

  it('supports not-applicable status and workflow stages', () => {
    expect(coerceStatusCode('not-applicable')).toBe('not-applicable');
    expect(coerceRegistrationWorkflowStage('filing')).toBe('filing');
    expect(coerceRegistrationWorkflowStage('nope')).toBeUndefined();
    expect(REGISTRATION_WORKFLOW_STAGES).toHaveLength(3);
    expect(registrationWorkflowShortLabel('collection')).toBe('Collection · Client');
  });
});
