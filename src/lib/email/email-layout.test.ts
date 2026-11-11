import { describe, expect, it } from 'vitest';
import {
  SBC_EMAIL_LOGO_DARK_PATH,
  SBC_EMAIL_LOGO_LIGHT_PATH,
  emailButton,
  emailMetaTable,
  emailStatusChip,
  emailStatusTone,
  emailStatusWord,
  renderEmailDocument,
  sbcEmailLogoUrl,
} from './email-layout';
import { SPECTRUM_EMAIL_COLORS, SPECTRUM_EMAIL_FONTS } from './spectrum-email-tokens';

const L = SPECTRUM_EMAIL_COLORS.light;
const D = SPECTRUM_EMAIL_COLORS.dark;

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
    expect(html).not.toContain('/sbc-logo.png');
    expect(html).not.toMatch(/>\s*VCFO Suite\s*</);
  });

  it('shows the white SBC mark only in the dark-mode block, hidden inline and in Outlook', () => {
    const html = renderEmailDocument({ brand: 'sbc', title: 'Pack', bodyHtml: '' });
    const darkBlock = /<div class="sp-dark-only" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">([\s\S]*?)<\/div>/.exec(html);
    expect(darkBlock?.[1]).toContain(SBC_EMAIL_LOGO_DARK_PATH);
    expect(html.split(SBC_EMAIL_LOGO_DARK_PATH)).toHaveLength(2);
  });

  it('uses Spectrum tokens only: no colour outside the generated palette', () => {
    const html = renderEmailDocument({
      title: 'T',
      eyebrow: 'E',
      bodyHtml: emailMetaTable([{ label: 'CIN', value: 'U12345KA2026PTC000001' }]) + emailStatusChip('Overdue'),
      cta: { label: 'Open', href: 'https://example.test' },
      signatureHtml: '<p>Regards</p>',
    });
    const palette = new Set([...Object.values(L), ...Object.values(D)].map((h) => h.toLowerCase()));
    const hexes = html.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(hexes.length).toBeGreaterThan(0);
    for (const hex of hexes) expect(palette.has(hex.toLowerCase()), hex).toBe(true);
  });

  it('is email-client safe: colour scheme meta, dark stylesheet, Outlook font fallback, brand-soft band', () => {
    const html = renderEmailDocument({ title: 'T', bodyHtml: '' });
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain(`.sp-card{background-color:${D['surface-raised']} !important;`);
    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain(SPECTRUM_EMAIL_FONTS.outlook);
    expect(html).toContain(`class="sp-wash sp-pad" bgcolor="${L['brand-soft']}"`);
    expect(html).toContain('family=Roboto');
  });
});

describe('Spectrum email parts', () => {
  it('draws the primary button in brand with on-brand text', () => {
    const a = emailButton('Open', 'https://x.test');
    expect(a).toContain(`background-color:${L.brand};color:${L['on-brand']}`);
    expect(a).toContain('border-radius:6px');
    expect(a).toContain('>Open</a>');
  });

  it('maps status labels to the six tones and keeps the words', () => {
    expect(emailStatusTone('Overdue, daily')).toBe('bad');
    expect(emailStatusTone('Due today')).toBe('warn');
    expect(emailStatusTone('Waiting on clients')).toBe('teal');
    expect(emailStatusTone('In progress')).toBe('prog');
    expect(emailStatusTone('Not started')).toBe('idle');
    expect(emailStatusTone('Done')).toBe('ok');
    expect(emailStatusTone('First reminder')).toBeNull();
    expect(emailStatusWord('Due today')).toContain(`color:${L.warning}`);
    expect(emailStatusWord('Due today')).toContain('>Due today</span>');
    expect(emailStatusWord('Escalation')).toBe('Escalation');
  });

  it('puts identifiers in the mono face without changing them', () => {
    const t = emailMetaTable([
      { label: 'CIN', value: 'U12345KA2026PTC000001' },
      { label: 'Ravi Kumar', value: 'DIN 01234567' },
      { label: 'Project', value: 'Acme' },
    ]);
    expect(t).toContain(`font-family:${SPECTRUM_EMAIL_FONTS.mono}`);
    expect(t).toMatch(/>U12345KA2026PTC000001</);
    expect(t).toMatch(/DIN <span[^>]*>01234567<\/span>/);
    expect(t).toMatch(/>Acme</);
  });
});
