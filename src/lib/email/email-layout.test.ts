import { describe, expect, it } from 'vitest';
import { renderEmailDocument } from './email-layout';

describe('renderEmailDocument', () => {
  it('keeps VCFO Suite letterhead by default', () => {
    const html = renderEmailDocument({ title: 'Hello', bodyHtml: '<p>Hi</p>' });
    expect(html).toMatch(/>\s*VCFO Suite\s*</);
    expect(html).toContain('Hello');
  });

  it('can render SBC letterhead', () => {
    const html = renderEmailDocument({
      brand: 'sbc',
      title: 'Pack',
      bodyHtml: '<p>Hi</p>',
    });
    expect(html).toMatch(/>\s*SBC\s*</);
    expect(html).not.toMatch(/>\s*VCFO Suite\s*</);
  });
});
