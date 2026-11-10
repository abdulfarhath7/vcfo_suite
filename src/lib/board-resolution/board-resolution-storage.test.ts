import { describe, expect, it } from 'vitest';
describe('boardResolutionDownloadName', () => {
  it('names the file after the company and the date in India time', async () => {
    const { boardResolutionDownloadName } = await import('./board-resolution-storage');
    // 20:00 UTC on 9 Nov is 01:30 on 10 Nov in India.
    expect(boardResolutionDownloadName('Sahyadri Robotics India Private Limited', new Date('2026-11-09T20:00:00Z'))).toBe(
      'Board-resolution-Sahyadri-Robotics-India-Private-Limited-10-Nov-2026.docx',
    );
  });

  it('keeps only safe characters and works without a company name', async () => {
    const { boardResolutionDownloadName } = await import('./board-resolution-storage');
    const on = new Date('2026-11-10T06:00:00Z');
    expect(boardResolutionDownloadName('M/s. Café & Co. "India"', on)).toBe('Board-resolution-M-s-Cafe-Co-India-10-Nov-2026.docx');
    expect(boardResolutionDownloadName('', on)).toBe('Board-resolution-10-Nov-2026.docx');
  });
});
