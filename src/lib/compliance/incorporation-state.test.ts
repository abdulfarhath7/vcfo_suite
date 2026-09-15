import { describe, expect, it } from 'vitest';
import { complianceEngagementsForRole } from '@/lib/compliance/incorporation-state';
import {
  CERTIFICATE_OF_INCORPORATION_STEP_ID,
  isIncorporated,
} from '@/lib/compliance/incorporation-state';

describe('isIncorporated', () => {
  it('is true when the incorporation date is set', () => {
    expect(isIncorporated({ incorporationDate: '2026-02-14' })).toBe(true);
    // The date wins even when the checklist has not caught up.
    expect(
      isIncorporated(
        { incorporationDate: '2026-02-14' },
        { [CERTIFICATE_OF_INCORPORATION_STEP_ID]: { status: 'in-progress' } },
      ),
    ).toBe(true);
  });

  it('is false when the date is null and the COI step is not terminal', () => {
    expect(isIncorporated({ incorporationDate: null })).toBe(false);
    expect(isIncorporated({ incorporationDate: '   ' })).toBe(false);
    expect(isIncorporated(undefined)).toBe(false);
    expect(
      isIncorporated(
        { incorporationDate: null },
        { [CERTIFICATE_OF_INCORPORATION_STEP_ID]: { status: 'in-progress' } },
      ),
    ).toBe(false);
    // A draft is not terminal.
    expect(
      isIncorporated(
        { incorporationDate: null },
        { [CERTIFICATE_OF_INCORPORATION_STEP_ID]: { status: 'awaiting-client' } },
      ),
    ).toBe(false);
    // Reopened for correction re-locks the step.
    expect(
      isIncorporated(
        { incorporationDate: null },
        {
          [CERTIFICATE_OF_INCORPORATION_STEP_ID]: {
            status: 'completed',
            unlockedFields: ['dateOfIncorporation'],
          },
        },
      ),
    ).toBe(false);
  });

  it('is true when the date is null but the COI step is terminal', () => {
    expect(
      isIncorporated(
        { incorporationDate: null },
        { [CERTIFICATE_OF_INCORPORATION_STEP_ID]: { status: 'completed' } },
      ),
    ).toBe(true);
    expect(
      isIncorporated(
        {},
        {
          [CERTIFICATE_OF_INCORPORATION_STEP_ID]: {
            status: 'in-progress',
            deliveredToClientAt: '2026-03-01T00:00:00.000Z',
          },
        },
      ),
    ).toBe(true);
  });

  it('ignores every other step', () => {
    expect(
      isIncorporated({ incorporationDate: null }, { 'pre-11': { status: 'completed' } }),
    ).toBe(false);
  });
});

describe('isIncorporated — start stage', () => {
  it('treats an engagement that started at Registration or Compliance as incorporated', () => {
    expect(isIncorporated({ incorporationDate: null, stage: 'Post-Incorporation' }, {})).toBe(true);
    expect(isIncorporated({ incorporationDate: null, stage: 'Operational Readiness' }, {})).toBe(true);
    expect(isIncorporated({ incorporationDate: null, stage: 'Pre-Incorporation' }, {})).toBe(false);
  });
});

describe('complianceEngagementsForRole', () => {
  const rows = [
    { id: 'pre', incorporationDate: null, stage: 'Pre-Incorporation' },
    { id: 'post', incorporationDate: '2026-09-10', stage: 'Pre-Incorporation' },
    { id: 'reg', incorporationDate: null, stage: 'Post-Incorporation' },
  ];
  const noState = () => ({});

  it('keeps only incorporated engagements for a lead', () => {
    expect(complianceEngagementsForRole('intern', rows, noState).map((r) => r.id)).toEqual(['post', 'reg']);
  });

  it('leaves every other role untouched', () => {
    for (const role of ['manager', 'admin', 'super_admin', 'client']) {
      expect(complianceEngagementsForRole(role, rows, noState).map((r) => r.id)).toEqual(['pre', 'post', 'reg']);
    }
  });
});
