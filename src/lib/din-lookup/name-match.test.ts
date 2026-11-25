import { describe, expect, it } from 'vitest';
import { compareDirectorName, nameMatchMessage, nameWords } from './name-match';

describe('nameWords', () => {
  it('upper-cases, drops punctuation and drops titles', () => {
    expect(nameWords('  Mr. Ameeruddin  Syed ')).toEqual(['AMEERUDDIN', 'SYED']);
    expect(nameWords('Dr Priya N. Sharma')).toEqual(['PRIYA', 'N', 'SHARMA']);
  });
});

describe('compareDirectorName', () => {
  it('matches whatever the word order, because MCA fixes none', () => {
    expect(compareDirectorName('Ameeruddin Syed', 'AMEERUDDIN SYED').kind).toBe('same');
    expect(compareDirectorName('Syed Ameeruddin', 'AMEERUDDIN SYED').kind).toBe('same');
  });

  it('calls an extra middle name close, and names the difference', () => {
    const match = compareDirectorName('Priya Nandini Sharma', 'PRIYA SHARMA');
    expect(match.kind).toBe('close');
    expect(match).toMatchObject({ extra: ['NANDINI'] });
    expect(nameMatchMessage(match, 'PRIYA SHARMA')).toContain('NANDINI');
  });

  it('treats an initial standing for a word as close, not a mismatch', () => {
    expect(compareDirectorName('A Syed', 'AMEERUDDIN SYED').kind).toBe('close');
  });

  it('calls a different person a mismatch', () => {
    expect(compareDirectorName('Rajesh Kumar', 'AMEERUDDIN SYED').kind).toBe('differs');
  });

  it('says so when there is nothing to compare', () => {
    expect(compareDirectorName('', 'AMEERUDDIN SYED').kind).toBe('unknown');
    expect(compareDirectorName('Rajesh Kumar', '').kind).toBe('unknown');
  });
});
