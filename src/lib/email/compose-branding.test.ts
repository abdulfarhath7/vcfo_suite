import { describe, expect, it } from 'vitest';
import {
  emailBrandingLabel,
  htmlFromPlainText,
  isEmailBranding,
  parseEmailBranding,
  plainTextFromHtml,
  wrapComposeBodyHtml,
} from './compose-branding';

describe('email branding helpers', () => {
  it('parses known keys', () => {
    expect(isEmailBranding('sbc')).toBe(true);
    expect(isEmailBranding('plain')).toBe(true);
    expect(isEmailBranding('vcfo')).toBe(false);
    expect(parseEmailBranding('nope')).toBe('sbc');
    expect(emailBrandingLabel('sbc')).toBe('SBC branded');
    expect(emailBrandingLabel('plain')).toBe('Plain');
  });

  it('wraps plain text without SBC letterhead', () => {
    const html = wrapComposeBodyHtml('Hello\nWorld', 'plain', 'Hi');
    expect(html).toContain('Hello<br />World');
    expect(html).not.toContain('>SBC<');
    expect(htmlFromPlainText('a&b')).toContain('a&amp;b');
  });

  it('wraps SBC templates in the branded shell', () => {
    const html = wrapComposeBodyHtml('Dear client,\n\nPlease sign.', 'sbc', 'Board pack');
    expect(html).toContain('/sbc-logo-light.png');
    expect(html).toContain('alt="SBC"');
    expect(html).toContain('Board pack');
    expect(html).toContain('Dear client,');
    expect(html).toContain('Please sign.');
    expect(html).toContain('This message was sent by SBC.');
    expect(html).not.toContain('/sbc-logo.png');
    expect(html).not.toMatch(/>\s*VCFO Suite\s*</);
  });

  it('round-trips simple html to plain text', () => {
    expect(plainTextFromHtml('<p>Hi</p><br />there')).toContain('Hi');
    expect(plainTextFromHtml('a&amp;b')).toBe('a&b');
  });
});
