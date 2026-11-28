import { describe, expect, it } from 'vitest';
import { asksToFetch, cardIsFresh, isFillRequest, modeFromText, scopeFromText } from './intent';

describe('isFillRequest', () => {
  it.each([
    'upload the data into vcfo suite tool',
    'Fill this into the app',
    'fill it',
    'please fill it in',
    'put these values in the app',
    'save it into spice+',
    'fill the details into VCFO Suite',
    'fill everything into the tool automatically',
    'fill it automatically',
    'fill it in manually',
    // Any request that opens with "fill" starts the whole fill, with or without a place.
    'fill business description from br',
    'fill everything',
    'fill bonterra',
    'fill data',
    'Please fill Bonterra',
    'can you fill the directors from the consent letters',
    'auto fill everything',
    'fill phase 2',
  ])('reads "%s" as a fill request', (text) => {
    expect(isFillRequest(text)).toBe(true);
  });

  it.each([
    'how do I fill step 3 in the app?',
    'how do I fill step 3?',
    'what is the PAN of Bonterra',
    'upload the PAN card',
    'Name: Bonterra India Pvt Ltd',
    'the client will fill the details tomorrow',
    'is step 3 filled?',
    'who fills the NIC code',
  ])('does not read "%s" as a fill request', (text) => {
    expect(isFillRequest(text)).toBe(false);
  });
});

describe('modeFromText', () => {
  it('reads auto and manual words, and nothing otherwise', () => {
    expect(modeFromText('fill it into the app automatically')).toBe('auto');
    expect(modeFromText('do it in the background')).toBe('auto');
    expect(modeFromText('fill it live in front of me')).toBe('manual');
    expect(modeFromText('fill it into the app')).toBeNull();
  });
});

describe('asksToFetch', () => {
  it.each(['fetch bonterra data and put it in name application in vcfo suite', 'pull the folder and fill it', 'take Kestrel documents from SharePoint and fill them into the app', 'get the files and put them in the app'])(
    'reads "%s" as asking to fetch',
    (text) => expect(asksToFetch(text)).toBe(true),
  );
  it.each(['fill it into the app', 'put these values in the app', 'how do I fetch the folder?', 'get it done in the app'])('does not read "%s" as asking to fetch', (text) => {
    expect(asksToFetch(text)).toBe(false);
  });
});

describe('scopeFromText', () => {
  const phase1 = ['pre-1', 'pre-2', 'pre-3', 'pre-4', 'pre-5'];
  it('reads name application as Phase 1', () => {
    const scope = scopeFromText('fetch bonterra data and put it in name application in vcfo suite');
    expect(scope?.stepIds).toEqual(phase1);
    expect(scope?.label).toMatch(/Phase 1/);
  });
  it('reads phase names and numbers', () => {
    expect(scopeFromText('fill the incorporation steps into the app')?.stepIds[0]).toBe('pre-13');
    expect(scopeFromText('fill post-incorporation into the app')?.stepIds[0]).toBe('post-1');
    expect(scopeFromText('fill post incorporation into the app')?.label).toMatch(/Phase 3/);
    expect(scopeFromText('fill phase 2 into the app')?.label).toMatch(/Phase 2/);
    expect(scopeFromText('fill pre-incorporation into the app')?.stepIds).toHaveLength(14);
    expect(scopeFromText('fill registration into the app')?.label).toMatch(/Phase 4/);
  });
  it('reads a step number along the checklist, or within the phase named', () => {
    expect(scopeFromText('fill step 3 into the app')).toMatchObject({ stepIds: ['pre-3'] });
    expect(scopeFromText('fill steps 2 to 4 into the app')?.stepIds).toEqual(['pre-2', 'pre-3', 'pre-4']);
    expect(scopeFromText('fill phase 2 step 1 into the app')?.stepIds).toEqual(['pre-13']);
    expect(scopeFromText('fill step 99 into the app')).toBeNull();
  });
  it('is null when no step is named, so every step runs', () => {
    expect(scopeFromText('fill it into the app step by step')).toBeNull();
    expect(scopeFromText('upload the data into vcfo suite tool')).toBeNull();
  });
});

describe('cardIsFresh', () => {
  const now = new Date('2026-11-28T10:00:00Z');
  const card = { createdAt: new Date('2026-11-28T09:50:00Z'), engagementId: 'eng-1' };
  it('uses a recent card for the client named, or when no client is named', () => {
    expect(cardIsFresh(card, { now, namedEngagementIds: [] })).toBe(true);
    expect(cardIsFresh(card, { now, namedEngagementIds: ['eng-1'] })).toBe(true);
  });
  it('reads again for another client or an old card', () => {
    expect(cardIsFresh(card, { now, namedEngagementIds: ['eng-2'] })).toBe(false);
    expect(cardIsFresh({ ...card, createdAt: new Date('2026-11-28T08:00:00Z') }, { now, namedEngagementIds: [] })).toBe(false);
  });
});
