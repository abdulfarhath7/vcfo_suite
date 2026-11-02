import type { DinLookupResult, DinProvider, DirectorRecord } from './types';

/**
 * Data sources for DIN lookup, chosen by `DIN_LOOKUP_PROVIDER`:
 *   off (default) — no live source; the chat says where to check on MCA.
 *   mock          — fixed demo records, never in production.
 * A paid source (Surepass, Signzy, Decentro…) is one more provider here that
 * maps the vendor's JSON onto `DirectorRecord`; nothing else changes.
 *
 * MCA itself is not a source: mca.gov.in refuses programs (403, probed
 * 2026-10-23), its director search sits behind a captcha, and its terms
 * forbid automated scraping. See docs/context/notes/director-lookup.md.
 */

/** Demo DINs from the 999999xx block, far above the numbers MCA has issued so far, so they do not match a real person. */
export const MOCK_DIRECTORS: Record<string, DirectorRecord> = {
  '99999901': {
    din: '99999901',
    name: 'DEMO DIRECTOR ONE',
    dinStatus: 'Approved',
    active: true,
    companies: [
      {
        name: 'DEMO TECHNOLOGIES PRIVATE LIMITED',
        cin: 'U72900TG2015PTC999901',
        designation: 'Managing Director',
        appointedOn: '2015-06-12',
      },
      {
        name: 'DEMO AGRO PRIVATE LIMITED',
        cin: 'U01100TG2019PTC999902',
        designation: 'Director',
        appointedOn: '2019-02-01',
      },
      {
        name: 'DEMO TRADING PRIVATE LIMITED',
        cin: 'U51909TG2011PTC999903',
        designation: 'Director',
        appointedOn: '2011-04-20',
        ceasedOn: '2018-09-30',
      },
    ],
  },
  '99999902': {
    din: '99999902',
    name: 'DEMO DIRECTOR TWO',
    dinStatus: 'Deactivated due to non-filing of DIR-3 KYC',
    active: false,
    companies: [
      {
        name: 'DEMO FOODS PRIVATE LIMITED',
        cin: 'U15400TG2020PTC999904',
        designation: 'Director',
        appointedOn: '2020-08-15',
      },
    ],
  },
};

export const mockDinProvider: DinProvider = {
  id: 'mock',
  async lookup(din): Promise<DinLookupResult> {
    const provenance = { providerId: 'mock', sourceLabel: 'Demo data — not from MCA', fetchedAt: new Date().toISOString() };
    const record = MOCK_DIRECTORS[din];
    return record ? { kind: 'found', record, ...provenance } : { kind: 'not_found', din, ...provenance };
  },
};

const offProvider: DinProvider = {
  id: 'off',
  async lookup(din) {
    return { kind: 'unavailable', din, reason: 'not_configured' };
  },
};

export function getDinProvider(env: NodeJS.ProcessEnv = process.env): DinProvider {
  const chosen = (env.DIN_LOOKUP_PROVIDER ?? 'off').trim().toLowerCase();
  // Demo records must never pass for MCA data on a live site.
  if (chosen === 'mock' && env.NODE_ENV !== 'production') return mockDinProvider;
  return offProvider;
}
