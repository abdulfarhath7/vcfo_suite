import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import {
  resolveChecklistItemFromStepParam,
  resolveEngagementFromRouteParam,
} from '@/lib/slug';

const base: Engagement = {
  id: 'e1',
  slug: 'abc-india',
  clientId: 'c1',
  companyName: 'ABC India',
  companyType: 'foreign',
  parentEntityName: null,
  parentEntityAddress: null,
  parentEntityRegistrationNumber: null,
  internId: 'tm1',
  adminId: 'admin',
  createdAt: '2026-01-01',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

const live: Engagement = {
  ...base,
  id: '75230cd9-3064-439f-80e3-1640d6aec440',
  slug: 'gamma-holdings',
};

describe('resolveEngagementFromRouteParam', () => {
  const list = [base, live];

  it('resolves slug', () => {
    expect(resolveEngagementFromRouteParam(list, 'abc-india')?.id).toBe('e1');
  });

  it('resolves app id', () => {
    expect(resolveEngagementFromRouteParam(list, 'e1')?.id).toBe('e1');
  });

  it('resolves live UUID', () => {
    expect(
      resolveEngagementFromRouteParam(list, '75230cd9-3064-439f-80e3-1640d6aec440')?.id,
    ).toBe('75230cd9-3064-439f-80e3-1640d6aec440');
  });

  it('does not throw on malformed URI encoding in route param', () => {
    expect(resolveEngagementFromRouteParam(list, '%E0%A4%A')).toBeUndefined();
  });

  it('resolves legacy demo DB uuid to app id', () => {
    expect(
      resolveEngagementFromRouteParam(
        list,
        '11111111-1111-1111-1111-111111111101',
      )?.id,
    ).toBe('e1');
  });
});

describe('resolveChecklistItemFromStepParam', () => {
  it('resolves pre-8 slug', () => {
    expect(resolveChecklistItemFromStepParam('execution-of-incorporation-documents')?.id).toBe(
      'pre-8',
    );
  });

  it('resolves checklist id', () => {
    expect(resolveChecklistItemFromStepParam('pre-8')?.slug).toBe(
      'execution-of-incorporation-documents',
    );
  });
});
