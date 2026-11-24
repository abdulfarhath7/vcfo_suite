import { describe, expect, it } from 'vitest';
import { isFillRequest, modeFromText } from './intent';

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
  ])('reads "%s" as a fill request', (text) => {
    expect(isFillRequest(text)).toBe(true);
  });

  it.each(['how do I fill step 3 in the app?', 'what is the PAN of Bonterra', 'upload the PAN card', 'Name: Bonterra India Pvt Ltd'])('does not read "%s" as a fill request', (text) => {
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
