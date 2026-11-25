import { describe, expect, it } from 'vitest';
import { autoMap, looseKey, matchOne, type MapItem, type MapTarget } from './automap';
import { mapDiscovery } from './discover';
import type { AppDiscovery } from './types';

const targets: MapTarget[] = [
  { vcfoType: 'engagement', vcfoId: 'e1', name: 'Bonterra India Private Limited', gstins: ['29ABCDE1234F1Z5'] },
  { vcfoType: 'engagement', vcfoId: 'e2', name: 'Summit Coworking LLP', pans: ['PQRSX9876K'] },
  { vcfoType: 'engagement', vcfoId: 'e3', name: 'Acme Widgets', aliases: ['Acme Widgets Pvt Ltd'] },
  { vcfoType: 'receivable_client', vcfoId: 'r1', name: 'Machinify, Inc', gstins: [] },
];

function item(p: Partial<MapItem>): MapItem {
  return { app: 'books', externalType: 'org', externalId: 'x', name: 'x', gstin: null, pan: null, ...p };
}

describe('auto map', () => {
  it('matches by GSTIN first', () => {
    const r = matchOne(item({ name: 'Totally different', gstin: '29abcde1234f1z5' }), targets);
    expect(r).toMatchObject({ status: 'mapped', match: 'auto_gstin', vcfoId: 'e1' });
  });

  it('then by PAN, including the PAN inside a GSTIN', () => {
    expect(matchOne(item({ name: 'Other', pan: 'PQRSX9876K' }), targets)).toMatchObject({ match: 'auto_pan', vcfoId: 'e2' });
    expect(matchOne(item({ name: 'Other', gstin: '27PQRSX9876K1Z2' }), targets)).toMatchObject({ match: 'auto_pan', vcfoId: 'e2' });
  });

  it('then by normalised name, including aliases', () => {
    expect(matchOne(item({ name: 'ACME WIDGETS PVT. LTD.' }), targets)).toMatchObject({ status: 'mapped', match: 'auto_name', vcfoId: 'e3' });
  });

  it('suggests a close name instead of mapping it', () => {
    expect(matchOne(item({ name: 'Bonterra' }), targets)).toMatchObject({ status: 'suggested', vcfoId: 'e1' });
  });

  it('leaves an unknown name unmapped and never guesses on a short key', () => {
    expect(matchOne(item({ name: 'Zeta' }), targets)).toMatchObject({ status: 'unmapped', vcfoId: null });
    expect(looseKey('The Co Pvt Ltd')).toBe('');
  });

  it('suggests when two records share an id', () => {
    const dup: MapTarget[] = [...targets, { vcfoType: 'engagement', vcfoId: 'e9', name: 'Bonterra Two', gstins: ['29ABCDE1234F1Z5'] }];
    expect(matchOne(item({ gstin: '29ABCDE1234F1Z5' }), dup)).toMatchObject({ status: 'suggested' });
  });

  it('maps customers to receivable clients before engagements; orgs only to engagements', () => {
    expect(matchOne(item({ externalType: 'customer', name: 'Machinify Inc.' }), targets)).toMatchObject({ vcfoType: 'receivable_client', vcfoId: 'r1' });
    expect(matchOne(item({ externalType: 'org', name: 'Machinify Inc.' }), targets)).toMatchObject({ status: 'unmapped' });
  });

  it("maps the firm's own org to the firm", () => {
    const firm = { name: 'SBC Consulting LLP', gstins: ['29AAAAA0000A1Z5'] };
    expect(matchOne(item({ name: 'SBC Consulting LLP' }), targets, firm)).toMatchObject({ vcfoType: 'firm', match: 'auto_name' });
    expect(matchOne(item({ name: 'x', gstin: '29AAAAA0000A1Z5' }), targets, firm)).toMatchObject({ vcfoType: 'firm', match: 'auto_gstin' });
    expect(matchOne(item({ externalId: '555' }), targets, { name: 'SBC', orgIds: ['555'] })).toMatchObject({ vcfoType: 'firm' });
  });

  it('autoMap keeps the item fields', () => {
    const [r] = autoMap([item({ externalId: 'org-1', name: 'Acme Widgets' })], targets);
    expect(r).toMatchObject({ externalId: 'org-1', status: 'mapped' });
  });
});

describe('mapDiscovery', () => {
  const results: AppDiscovery[] = [
    {
      app: 'books',
      used: true,
      orgs: [
        { app: 'books', externalOrgId: 'sbc', name: 'SBC Consulting LLP', gstin: null, pan: null, counts: {} },
        { app: 'books', externalOrgId: 'bon', name: 'Bonterra India Private Limited', gstin: null, pan: null, counts: {} },
      ],
      entities: [
        { app: 'books', externalType: 'customer', externalId: 'c1', name: 'Machinify Inc', gstin: null, pan: null, externalOrgId: 'sbc' },
        { app: 'books', externalType: 'customer', externalId: 'c2', name: 'Some buyer of Bonterra', gstin: null, pan: null, externalOrgId: 'bon' },
      ],
    },
  ];

  it("matches customers only inside the firm's own Books org", () => {
    const rows = mapDiscovery(results, targets, { name: 'SBC Consulting LLP' });
    expect(rows.find((r) => r.externalId === 'sbc')).toMatchObject({ vcfoType: 'firm' });
    expect(rows.find((r) => r.externalId === 'bon')).toMatchObject({ vcfoType: 'engagement', vcfoId: 'e1' });
    expect(rows.find((r) => r.externalId === 'c1')).toMatchObject({ vcfoType: 'receivable_client', externalOrgId: 'sbc' });
    expect(rows.find((r) => r.externalId === 'c2')).toBeUndefined();
  });

  it('uses orgs a person set to the firm earlier', () => {
    const rows = mapDiscovery(results, targets, { name: '' }, ['sbc']);
    expect(rows.find((r) => r.externalId === 'c1')).toBeDefined();
  });
});
