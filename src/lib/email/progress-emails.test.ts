import { describe, expect, it } from 'vitest';
import { buildProgressEmail } from './progress-emails';

describe('buildProgressEmail', () => {
  it('writes manager-approval copy for intern requests', () => {
    const copy = buildProgressEmail({
      kind: 'lead_requested_review',
      companyName: 'Acme Pvt Ltd',
      itemId: 'pre-1',
      portalHref: 'https://example.test/app/manager/projects/acme/step/x',
      audience: 'lead',
    });
    expect(copy.subject).toContain('manager approval requested');
    expect(copy.text).toContain('Acme Pvt Ltd');
    expect(copy.html).toContain('Review in workspace');
  });

  it('writes client-submit copy for staff', () => {
    const copy = buildProgressEmail({
      kind: 'client_submitted',
      companyName: 'Acme Pvt Ltd',
      itemId: 'pre-1',
      portalHref: '/app/manager/projects/acme/step/x',
      audience: 'lead',
    });
    expect(copy.subject).toContain('client submitted');
  });
});
