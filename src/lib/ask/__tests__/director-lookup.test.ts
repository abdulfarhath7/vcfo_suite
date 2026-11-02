import { describe, expect, it } from 'vitest';
import { answerEnvelopeSchema } from '@/data/ask/schema';
import { directorLookupAnswer, withoutDirectorLookups } from '@/lib/ask/director-answer';
import { dinStatusIsActive, findDinInMessage, isValidDin } from '@/lib/director-lookup/din';
import { getDinProvider, mockDinProvider } from '@/lib/director-lookup/providers';

describe('findDinInMessage', () => {
  it('reads a named DIN in the ways people type it', () => {
    expect(findDinInMessage('check DIN 01234567 please')).toBe('01234567');
    expect(findDinInMessage('din:01234567')).toBe('01234567');
    expect(findDinInMessage('DIN no. 01234567')).toBe('01234567');
    expect(findDinInMessage('Director Identification Number 01234567?')).toBe('01234567');
    expect(findDinInMessage('  01234567 ')).toBe('01234567');
  });

  it('ignores 8-digit numbers that are not named as a DIN', () => {
    expect(findDinInMessage('fee of 10000000 for 20261026')).toBeNull();
    expect(findDinInMessage('DIN 123456789')).toBeNull();
    expect(findDinInMessage('DIN 1234567')).toBeNull();
    expect(findDinInMessage('what is a DIN?')).toBeNull();
  });

  it('validates the 8-digit shape only', () => {
    expect(isValidDin('00012345')).toBe(true);
    expect(isValidDin('1234567')).toBe(false);
    expect(isValidDin('1234567a')).toBe(false);
  });

  it('reads MCA status text', () => {
    expect(dinStatusIsActive('Approved')).toBe(true);
    expect(dinStatusIsActive('Deactivated due to non-filing of DIR-3 KYC')).toBe(false);
    expect(dinStatusIsActive('Surrendered')).toBe(false);
    expect(dinStatusIsActive('Under process')).toBeNull();
  });
});

describe('getDinProvider', () => {
  it('is off unless chosen, and mock never runs in production', () => {
    expect(getDinProvider({ NODE_ENV: 'development' } as NodeJS.ProcessEnv).id).toBe('off');
    expect(getDinProvider({ NODE_ENV: 'development', DIN_LOOKUP_PROVIDER: 'mock' } as NodeJS.ProcessEnv).id).toBe('mock');
    expect(getDinProvider({ NODE_ENV: 'production', DIN_LOOKUP_PROVIDER: 'mock' } as NodeJS.ProcessEnv).id).toBe('off');
  });
});

describe('directorLookupAnswer', () => {
  it('shows an active director with current and past companies, and its source', async () => {
    const answer = directorLookupAnswer(await mockDinProvider.lookup('99999901'));
    expect(answerEnvelopeSchema.safeParse(answer).success).toBe(true);
    expect(answer.origin).toBe('deterministic');
    expect(answer.line).toContain('DEMO DIRECTOR ONE (DIN 99999901) — DIN status: Approved');
    expect(answer.line).toContain('Director in 2 companies now, 1 in the past.');
    expect(answer.visual).toMatchObject({ type: 'keyFacts' });
    expect(answer.citations[0]!.label).toMatch(/^Demo data — not from MCA · fetched /);
  });

  it('warns when a DIN is deactivated for KYC', async () => {
    const answer = directorLookupAnswer(await mockDinProvider.lookup('99999902'));
    expect(answerEnvelopeSchema.safeParse(answer).success).toBe(true);
    expect(answer.line).toContain('must file DIR-3 KYC');
  });

  it('says so when no director has that DIN', async () => {
    const answer = directorLookupAnswer(await mockDinProvider.lookup('99999999'));
    expect(answerEnvelopeSchema.safeParse(answer).success).toBe(true);
    expect(answer.line).toContain('No director found for DIN 99999999');
  });

  it('points to the MCA portal when no live source is switched on', async () => {
    const answer = directorLookupAnswer(await getDinProvider({} as NodeJS.ProcessEnv).lookup('01234567'));
    expect(answerEnvelopeSchema.safeParse(answer).success).toBe(true);
    expect(answer.line).toContain('not switched on yet');
    expect(answer.citations[0]!.url).toBe('https://www.mca.gov.in/');
  });

  it('caps a long directorship list within the answer limits', () => {
    const companies = Array.from({ length: 12 }, (_, i) => ({ name: `DEMO COMPANY ${i} PRIVATE LIMITED`, appointedOn: '2020-01-01' }));
    const answer = directorLookupAnswer({
      kind: 'found',
      record: { din: '99999903', name: 'DEMO MANY', dinStatus: 'Approved', active: true, companies },
      providerId: 'mock',
      sourceLabel: 'Demo data — not from MCA',
      fetchedAt: new Date().toISOString(),
    });
    expect(answerEnvelopeSchema.safeParse(answer).success).toBe(true);
    expect(answer.visual).toMatchObject({ facts: expect.arrayContaining([{ k: 'More', v: '8 more current directorships' }]) });
  });
});

describe('withoutDirectorLookups', () => {
  it('keeps DIN questions and their replies away from later model calls', () => {
    const history = [
      { sender: 'user' as const, text: 'What is overdue?' },
      { sender: 'assistant' as const, text: 'Two filings are overdue.' },
      { sender: 'user' as const, text: 'DIN 99999901' },
      { sender: 'assistant' as const, text: 'DEMO DIRECTOR ONE (DIN 99999901) — DIN status: Approved.' },
      { sender: 'user' as const, text: 'Explain FC-GPR' },
    ];
    expect(withoutDirectorLookups(history).map((m) => m.text)).toEqual([
      'What is overdue?',
      'Two filings are overdue.',
      'Explain FC-GPR',
    ]);
  });
});
