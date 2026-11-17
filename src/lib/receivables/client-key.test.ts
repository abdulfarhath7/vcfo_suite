import { describe, expect, it } from 'vitest';
import { clientByPrefix, clientKey } from './client-key';

const clients = ['Bupa', 'Net Documents', 'Net Documents India', 'Routeware INC', 'Routeware India', 'Acumatica INC', 'ANSR Comply', 'IE ANSR'].map((name) => ({ name, clientKey: clientKey(name) }));
const find = (tally: string) => clientByPrefix(clients, clientKey(tally))?.name;

describe('clientByPrefix', () => {
  it('finds the short workbook name a Tally legal name starts with', () => {
    expect(find('Bupa Capability Centre Private Limited')).toBe('Bupa');
    expect(find('Ansr-Comply Global Innovation Center Private Limited')).toBe('ANSR Comply');
    expect(find('IE ANSR Private Limited')).toBe('IE ANSR');
    expect(find('Routeware India Private Limited')).toBe('Routeware India');
  });

  it('takes the longest match and ignores spaces', () => {
    expect(find('NetDocuments India Private Limited')).toBe('Net Documents India');
    expect(find('NetDocuments Software Inc')).toBe('Net Documents');
  });

  it('guesses nothing when no name fits or two fit equally', () => {
    expect(find('Acumatica India Private Limited')).toBeUndefined();
    expect(find('Routeware')).toBeUndefined();
    expect(find('Machinify Inc')).toBeUndefined();
  });
});
