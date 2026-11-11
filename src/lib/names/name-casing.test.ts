import { describe, expect, it } from 'vitest';
import { properNameCase } from './name-casing';

describe('properNameCase (GL-09)', () => {
  it('starts each word of a company name with a capital letter', () => {
    expect(properNameCase('ember technologies private limited')).toBe('Ember Technologies Private Limited');
  });

  it('writes LLP and OPC in capitals and capitalises a word in brackets', () => {
    expect(properNameCase('abc (india) llp')).toBe('Abc (India) LLP');
    expect(properNameCase('solo ventures (opc) private limited')).toBe('Solo Ventures (OPC) Private Limited');
  });

  it('keeps a word the person typed in capitals', () => {
    expect(properNameCase('EMBER technologies')).toBe('EMBER Technologies');
    expect(properNameCase('IBM india pvt ltd')).toBe('IBM India Pvt Ltd');
  });

  it('cases person names, hyphens and apostrophes', () => {
    expect(properNameCase('asha rao')).toBe('Asha Rao');
    expect(properNameCase("anne-marie o'brien")).toBe("Anne-Marie O'brien");
    expect(properNameCase("rao's holdings")).toBe("Rao's Holdings");
  });

  it('tidies spaces and leaves a missing-answer placeholder alone', () => {
    expect(properNameCase('  ember   tech ')).toBe('Ember Tech');
    expect(properNameCase('[Parent entity name]')).toBe('[Parent entity name]');
    expect(properNameCase(null)).toBe('');
  });
});
