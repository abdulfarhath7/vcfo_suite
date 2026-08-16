import { describe, expect, it } from 'vitest';
import {
  companyFromAddress,
  isRetryableFromIdentityError,
  parseProviderErrorMessage,
  quoteFromHeader,
  resendFromCandidates,
  sanitizeEmailLocalPart,
} from './send-email-shared';

describe('quoteFromHeader', () => {
  it('quotes display names', () => {
    expect(quoteFromHeader('VCFO Suite <info@sbcllp.in>')).toBe(
      '"VCFO Suite" <info@sbcllp.in>',
    );
  });
});

describe('resendFromCandidates', () => {
  it('adds noreply@ on the same domain after info@', () => {
    const list = resendFromCandidates('VCFO Suite <info@sbcllp.in>');
    expect(list.some((f) => f.toLowerCase().includes('info@sbcllp.in'))).toBe(true);
    expect(list.some((f) => extractNoreply(f))).toBe(true);
  });
});

function extractNoreply(from: string): boolean {
  return from.toLowerCase().includes('noreply@sbcllp.in');
}

describe('parseProviderErrorMessage', () => {
  it('reads Resend JSON message', () => {
    expect(
      parseProviderErrorMessage(
        '{"statusCode":403,"name":"validation_error","message":"The domain is not verified."}',
      ),
    ).toBe('The domain is not verified.');
  });
});

describe('sanitizeEmailLocalPart', () => {
  it('hyphenates and lowercases', () => {
    expect(sanitizeEmailLocalPart('Acme Pvt Ltd')).toBe('acme-pvt-ltd');
  });
  it('falls back to project', () => {
    expect(sanitizeEmailLocalPart('!!!')).toBe('project');
  });
});

describe('companyFromAddress', () => {
  it('uses company_name@domain, not the engagement slug', () => {
    expect(
      companyFromAddress({
        slug: 'e12-other',
        companyName: 'Acme Pvt Ltd',
        fromOverride: 'VCFO Suite <info@sbctrack.in>',
      }),
    ).toBe('"Acme Pvt Ltd" <acme-pvt-ltd@sbctrack.in>');
  });
});

describe('isRetryableFromIdentityError', () => {
  it('retries unverified from', () => {
    expect(isRetryableFromIdentityError(403, 'The sbcllp.in domain is not verified')).toBe(
      true,
    );
  });
  it('does not retry auth failures', () => {
    expect(isRetryableFromIdentityError(401, 'API key is invalid')).toBe(false);
  });
});
