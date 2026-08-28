import { describe, expect, it } from 'vitest';
import {
  SBC_EMAIL_LOGO_DARK_PATH,
  SBC_EMAIL_LOGO_LIGHT_PATH,
  renderEmailDocument,
  sbcEmailLogoUrl,
} from './email-layout';

describe('renderEmailDocument', () => {
  it('keeps VCFO Suite letterhead by default', () => {
    const html = renderEmailDocument({ title: 'Hello', bodyHtml: '<p>Hi</p>' });
    expect(html).toMatch(/>\s*VCFO Suite\s*</);
    expect(html).toContain('Hello');
    expect(html).not.toContain(SBC_EMAIL_LOGO_LIGHT_PATH);
  });

  it('can render SBC letterhead with the hosted light lockup', () => {
    const html = renderEmailDocument({
      brand: 'sbc',
      title: 'Pack',
      bodyHtml: '<p>Hi</p>',
    });
    expect(html).toContain(sbcEmailLogoUrl('light'));
    expect(html).toContain(SBC_EMAIL_LOGO_LIGHT_PATH);
    expect(html).toContain('alt="SBC"');
    expect(html).not.toContain(SBC_EMAIL_LOGO_DARK_PATH);
    expect(html).not.toContain('/sbc-logo.png');
    expect(html).not.toMatch(/>\s*VCFO Suite\s*</);
  });
});
