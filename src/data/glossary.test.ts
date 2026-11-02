import { describe, expect, it } from 'vitest';
import { glossaryFor, leadingTerm } from './glossary';

describe('glossary', () => {
  it('finds an exact code in any case', () => {
    expect(glossaryFor('gstr-3b')?.term).toBe('GSTR-3B');
    expect(glossaryFor('Nothing')).toBeUndefined();
  });

  it('marks only the code that starts a title, longest code first', () => {
    expect(leadingTerm('GSTR-3B · September')).toMatchObject({ end: 7 });
    expect(leadingTerm('DIR-3 KYC for Asha')?.entry.term).toBe('DIR-3 KYC');
    expect(leadingTerm('TDS return 26Q')?.entry.term).toBe('TDS');
  });

  it('does not match a code that runs into another word', () => {
    expect(leadingTerm('PTO request')).toBeUndefined();
  });
});
