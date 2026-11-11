import { describe, expect, it } from 'vitest';
import { canRoleEditField, stripLeadOnlyResponses } from '@/lib/incorporation/pre-inc-direct-flow';
import { dinVerificationOf, stampDinChecks } from './din-verification';

const NOW = '2026-11-11T09:30:00.000Z';
const k = (field: string) => `directors.e1.${field}`;

describe('DR-01 DIN verification', () => {
  it('shows "DIN to be applied in SPICe+" for a director with no DIN, and no check badge', () => {
    expect(dinVerificationOf({ [k('hasDin')]: 'no', [k('dinStatus')]: 'verified' }, 'e1')).toEqual({ kind: 'to-apply' });
  });

  it('reads the recorded result with who and when', () => {
    const v = dinVerificationOf({ [k('dinStatus')]: 'mismatch', [k('dinMismatchNote')]: 'Date of birth', [k('dinCheckedBy')]: 'Divya', [k('dinCheckedAt')]: NOW }, 'e1');
    expect(v).toEqual({ kind: 'mismatch', note: 'Date of birth', by: 'Divya', at: NOW });
    expect(dinVerificationOf({}, 'e1')).toEqual({ kind: 'unchecked' });
  });

  it('stamps the actor and time when the status changes, and drops stamps a browser sent', () => {
    const out = stampDinChecks({}, { [k('dinStatus')]: 'verified', [k('dinCheckedBy')]: 'Someone else' }, 'Divya', NOW);
    expect(out).toEqual({ [k('dinStatus')]: 'verified', [k('dinCheckedBy')]: 'Divya', [k('dinCheckedAt')]: NOW });
    // Unchanged status: no new stamp.
    expect(stampDinChecks({ [k('dinStatus')]: 'verified' }, { [k('dinStatus')]: 'verified' }, 'Divya', NOW)).toEqual({ [k('dinStatus')]: 'verified' });
  });

  it('lets only the lead record the check, even while the client fills the step', () => {
    expect(canRoleEditField('intern', 'pre-15', k('dinStatus'))).toBe(true);
    expect(canRoleEditField('intern', 'pre-15', k('firstName'))).toBe(false);
    expect(canRoleEditField('client', 'pre-15', k('dinStatus'))).toBe(false);
    expect(stripLeadOnlyResponses('pre-15', { [k('dinStatus')]: 'verified', [k('din')]: '01234567' })).toEqual({ [k('din')]: '01234567' });
  });
});
