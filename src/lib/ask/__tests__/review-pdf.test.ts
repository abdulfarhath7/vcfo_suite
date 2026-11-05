// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderReviewPdf } from '@/lib/ask/feeds/review-pdf';

describe('renderReviewPdf', () => {
  // Every MCA gazette is printed in Hindi and English; the built-in Helvetica has no Hindi
  // letters, and on 2026-11-05 a gazette's review PDF failed with "reading 'S'".
  it('renders for a bilingual gazette', async () => {
    const pdf = await renderReviewPdf({
      firmName: 'SBC',
      sourceLabel: 'MCA · Gazette of India',
      act: 'Companies Act',
      title: 'MCA gazette notification · कंपनी संशोधन नियम, 2026',
      number: null,
      kind: 'Notification',
      publishedAt: '2026-11-03',
      sourceUrl: 'https://egazette.gov.in/WriteReadData/2026/277682.pdf',
      summary: 'Expands the rules for listing equity instruments abroad (₹ 5 crore).',
      text: 'कंपनी (अनुज्ञेर् अजधकाठरताओं में साधारण िेर्र सूचीबद्ध करना) जनर्म, 2024\nIn exercise of the powers conferred by section 23 of the Companies Act, 2013.',
      pieces: 7,
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30_000);
});
