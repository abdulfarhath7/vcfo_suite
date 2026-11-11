import { describe, expect, it } from 'vitest';
import { standardDownloadName } from './download-name';

/** GL-08: one shared name for every download, checked with five client names. */
describe('standardDownloadName', () => {
  const on = new Date('2026-11-11T06:00:00Z');

  it.each([
    ['Ember Technologies Private Limited', 'Board-Resolution_Ember-Technologies-Private-Limited_11-11-2026.docx'],
    ['ember technologies private limited', 'Board-Resolution_Ember-Technologies-Private-Limited_11-11-2026.docx'],
    ['abc (india) llp', 'Board-Resolution_Abc-(India)-LLP_11-11-2026.docx'],
    ['M/s. Café & Co: "India" <Pvt>', 'Board-Resolution_M-S.-Cafe-&-Co-India-Pvt_11-11-2026.docx'],
    ['', 'Board-Resolution_11-11-2026.docx'],
  ])('names the board resolution of %j', (client, expected) => {
    expect(standardDownloadName('Board Resolution', client, 'docx', on)).toBe(expected);
  });

  it('follows the pattern for each file type', () => {
    for (const ext of ['docx', 'pdf', 'xlsx', 'zip']) {
      expect(standardDownloadName('Project', 'Ember Pvt Ltd', ext, on)).toBe(`Project_Ember-Pvt-Ltd_11-11-2026.${ext}`);
    }
  });

  it('uses the date in India, not on the server', () => {
    // 20:00 UTC on 10 Nov is 01:30 on 11 Nov in India.
    expect(standardDownloadName('MOA', 'Ember', 'docx', new Date('2026-11-10T20:00:00Z'))).toBe('MOA_Ember_11-11-2026.docx');
  });

  it('adds the director to a director document', () => {
    expect(standardDownloadName('DIR-2 Asha Rao', 'Ember', '.DOCX', on)).toBe('DIR-2-Asha-Rao_Ember_11-11-2026.docx');
  });
});
