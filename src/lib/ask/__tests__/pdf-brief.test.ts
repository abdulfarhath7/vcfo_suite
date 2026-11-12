// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BRIEF_DISCLAIMER, briefFilename, renderBriefPdf } from '@/lib/ask/pdf-brief';

describe('PDF brief (F3)', () => {
  it('renders a PDF with visuals and carries the disclaimer', async () => {
    const pdf = await renderBriefPdf({
      companyName: 'Acme India Private Limited',
      firmName: 'SBC',
      now: new Date('2026-09-30T00:00:00Z'),
      items: [
        {
          title: 'SPICe+ Part A',
          answer: {
            line: 'Part A reserves the name.',
            why: 'Nothing else can be filed first.',
            visual: {
              type: 'flow',
              stages: [
                { label: 'Part A', state: 'here' },
                { label: 'Part B', state: 'next' },
              ],
            },
            citations: [{ id: 'mca', label: 'MCA' }],
            actions: [],
            origin: 'reviewed',
            depth: 'normal',
          },
        },
      ],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
    expect(BRIEF_DISCLAIMER).toBe('Informational only. Your firm confirms decisions for your company.');
  }, 30_000);

  it('gives the file the standard name (GL-08)', () => {
    const on = new Date('2026-11-11T06:00:00Z');
    expect(briefFilename('Acme India Private Limited', undefined, on)).toBe('Brief_Acme-India-Private-Limited_11-11-2026.pdf');
    expect(briefFilename('Acme India Private Limited', 'Status October 2026', on)).toBe('Status-October-2026_Acme-India-Private-Limited_11-11-2026.pdf');
  });
});
