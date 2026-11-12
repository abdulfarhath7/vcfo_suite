import { describe, expect, it } from 'vitest';
import { PACK_GATES, assistLivePackIds, packHasHost, packLive, packSchema, parsePack } from './pack';
import { getPack, listPacks } from './registry';
import mcaV3 from './packs/mca-v3.json';

describe('portal packs', () => {
  it('holds the nine packs, each parsed against the schema', () => {
    expect(listPacks().map((p) => p.id)).toEqual(['mca-v3', 'income-tax-efiling', 'traces', 'protean-tin', 'gst', 'epfo', 'esic', 'udyam', 'dgft']);
  });

  it('starts every pack mock-only; only mca-v3 has pages and selectors so far', () => {
    for (const pack of listPacks()) {
      expect(pack.legalStatus, pack.id).toBe('mock-only');
      expect(pack.gates).toEqual(expect.arrayContaining(['LOGIN', 'SUBMIT']));
      for (const g of pack.gates) expect(PACK_GATES).toContain(g);
      if (pack.id !== 'mca-v3') {
        expect(pack.pages).toEqual([]);
        expect(pack.selectors).toEqual({});
      }
    }
  });

  it('builds mca-v3 from the captures: real URLs, AEM ready check, the info pop-up and the waits', () => {
    const mca = getPack('mca-v3')!;
    expect(mca.hosts).toEqual(['www.mca.gov.in']);
    expect(mca.pages.find((p) => p.id === 'spice-a')?.urlPattern).toMatch(/incorporation-change-services\/spice\.html$/);
    expect(mca.pages.find((p) => p.id === 'spice-b-address')?.urlPattern).toMatch(/SpicePartB\.html$/);
    expect(mca.pages.every((p) => p.readySelector.includes('#guideContainer-rootPanel__'))).toBe(true);
    expect(mca.popups).toEqual([{ id: 'info-modal', label: 'Information pop-up (OK)', css: '#okInfoModalBtn' }]);
    expect(mca.waits).toEqual({ readyMs: 30000, optionsMs: 8000, afterPincodeMs: 2000 });
    expect(mca.selectors.wizardStep).toBe('li.listep');
    expect(mca.source).toMatch(/5e58bcf/);
  });

  it('flags GST as needing the CS opinion first, citing its terms', () => {
    const gst = getPack('gst')!;
    expect(gst.needsCsOpinionFirst).toBe(true);
    expect(gst.notes.join(' ')).toMatch(/unauthorised|authorised/);
    expect(listPacks().filter((p) => p.needsCsOpinionFirst).map((p) => p.id)).toEqual(['gst']);
  });

  it('refuses a pack without legalStatus, an unknown status, a pack that drops LOGIN or SUBMIT, and a pop-up that reads like Submit', () => {
    const { legalStatus: _l, ...noStatus } = mcaV3;
    expect(packSchema.safeParse(noStatus).success).toBe(false);
    expect(packSchema.safeParse({ ...mcaV3, legalStatus: 'live' }).success).toBe(false);
    expect(packSchema.safeParse({ ...mcaV3, gates: ['DSC', 'PAY'] }).success).toBe(false);
    expect(packSchema.safeParse({ ...mcaV3, popups: [{ id: 'go', label: 'Submit form', css: '#x' }] }).success).toBe(false);
    expect(packSchema.safeParse({ ...mcaV3, hosts: ['https://www.mca.gov.in/'] }).success).toBe(false);
    expect(packSchema.safeParse({ ...mcaV3, extra: 1 }).success).toBe(false);
    expect(() => parsePack({ ...mcaV3, pages: [mcaV3.pages[0], mcaV3.pages[0]] })).toThrow(/pack_page_duplicate/);
  });

  it('matches hosts exactly, or subdomains for *.', () => {
    expect(packHasHost({ hosts: ['www.mca.gov.in'] }, 'WWW.MCA.GOV.IN:443')).toBe(true);
    expect(packHasHost({ hosts: ['www.mca.gov.in'] }, 'mca.gov.in')).toBe(false);
    expect(packHasHost({ hosts: ['*.gst.gov.in'] }, 'reg.gst.gov.in')).toBe(true);
    expect(packHasHost({ hosts: ['*.gst.gov.in'] }, 'evilgst.gov.in')).toBe(false);
  });
});

describe('per-pack live switch', () => {
  const cleared = { id: 'mca-v3', legalStatus: 'cs-cleared' as const };
  const mockOnly = { id: 'mca-v3', legalStatus: 'mock-only' as const };

  it('is off by default', () => {
    expect(assistLivePackIds({}).size).toBe(0);
    expect(packLive(cleared, {})).toBe(false);
  });

  it('needs both ASSIST_LIVE_PACKS and a cs-cleared pack', () => {
    expect(packLive(cleared, { ASSIST_LIVE_PACKS: 'mca-v3,income-tax-efiling' })).toBe(true);
    expect(packLive(mockOnly, { ASSIST_LIVE_PACKS: 'mca-v3' })).toBe(false);
    expect(packLive({ id: 'gst', legalStatus: 'cs-cleared' }, { ASSIST_LIVE_PACKS: 'mca-v3' })).toBe(false);
    expect([...assistLivePackIds({ ASSIST_LIVE_PACKS: ' MCA-V3 , traces,,bad id ' })]).toEqual(['mca-v3', 'traces']);
  });

  it('keeps ASSIST_LIVE_PORTALS=true as a deprecated alias for mca-v3 only', () => {
    expect([...assistLivePackIds({ ASSIST_LIVE_PORTALS: 'true' })]).toEqual(['mca-v3']);
    expect(packLive(cleared, { ASSIST_LIVE_PORTALS: 'true' })).toBe(true);
    expect(packLive({ id: 'income-tax-efiling', legalStatus: 'cs-cleared' }, { ASSIST_LIVE_PORTALS: 'true' })).toBe(false);
    // The real mca-v3 pack is still mock-only, so the alias turns nothing on today.
    expect(packLive(getPack('mca-v3')!, { ASSIST_LIVE_PORTALS: 'true' })).toBe(false);
  });
});
