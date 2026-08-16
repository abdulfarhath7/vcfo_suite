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

  it('shows 14 registrations matching the master sheet (no PAN/TAN)', () => {
    const ids = getPhaseItems(getRegistrationPhases()).map((i) => i.id);
    expect(ids).toHaveLength(14);
    expect(ids[0]).toBe('reg-4');
    expect(ids[6]).toBe('reg-5');
    expect(ids).not.toContain('reg-2');
    expect(getRegistrationPhases()[0]!.items[0]!.title).toBe('GST & LUT');
    expect(getRegistrationPhases()[0]!.items[6]!.title).toBe('LUT Filing');
  });

  it('supports not-applicable status and workflow stages', () => {
    expect(coerceStatusCode('not-applicable')).toBe('not-applicable');
    expect(coerceRegistrationWorkflowStage('filing')).toBe('filing');
    expect(coerceRegistrationWorkflowStage('nope')).toBeUndefined();
    expect(REGISTRATION_WORKFLOW_STAGES).toHaveLength(3);
    expect(registrationWorkflowShortLabel('collection')).toBe('Collection · Client');
  });
});
