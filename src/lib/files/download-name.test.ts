import { describe, expect, it } from 'vitest';
import { attachmentDisposition, istDay, standardDownloadName, standardNameFromFile } from './download-name';

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

  it('names an uploaded file inside a ZIP after its own name, and leaves a standard name alone', () => {
    expect(standardNameFromFile('PAN card.pdf', 'Ember Pvt Ltd', on)).toBe('PAN-card_Ember-Pvt-Ltd_11-11-2026.pdf');
    expect(standardNameFromFile('folder/scan', null, on)).toBe('scan_11-11-2026.bin');
    expect(standardNameFromFile('team-tasks.csv', null, on)).toBe('team-tasks_11-11-2026.csv');
    expect(standardNameFromFile('MOA_Ember_01-11-2026.docx', 'Other', on)).toBe('MOA_Ember_01-11-2026.docx');
  });

  it('reads an IST day, and writes a header with an ASCII and a UTF-8 name', () => {
    expect(standardDownloadName('Receivables', 'Ember', 'xlsx', istDay('2026-11-11'))).toBe('Receivables_Ember_11-11-2026.xlsx');
    expect(attachmentDisposition('A_B_11-11-2026.pdf')).toBe(`attachment; filename="A_B_11-11-2026.pdf"; filename*=UTF-8''A_B_11-11-2026.pdf`);
    expect(attachmentDisposition('x.pdf', 'inline').startsWith('inline;')).toBe(true);
  });
});
