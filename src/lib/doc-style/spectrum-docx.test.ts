// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  DOCX_COLORS,
  DOCX_FONTS,
  docxDocDefaultsXml,
  docxFontTableXml,
  docxHeaderCellProps,
  docxIdentifierRunProps,
  docxRunProps,
  docxStatus,
  spectrumAccentHexes,
} from './spectrum-docx';
import { SPECTRUM_FONTS, SPECTRUM_HEX } from './spectrum-tokens';

const word = (hex: string) => hex.slice(1).toUpperCase();

describe('spectrum-docx', () => {
  it('names the Spectrum faces with Arial and Consolas fallbacks in the font table', () => {
    expect(DOCX_FONTS.ui.name).toBe(SPECTRUM_FONTS.ui);
    expect(DOCX_FONTS.mono.name).toBe(SPECTRUM_FONTS.mono);
    const table = docxFontTableXml();
    expect(table).toContain(`<w:font w:name="${SPECTRUM_FONTS.ui}"><w:altName w:val="Arial"/>`);
    expect(table).toContain(`<w:font w:name="${SPECTRUM_FONTS.mono}"><w:altName w:val="Consolas"/>`);
  });

  it('writes body runs in the ui face and ink, identifiers in the mono face', () => {
    const body = docxRunProps({ pt: 10.5 });
    expect(body).toContain(`w:ascii="${SPECTRUM_FONTS.ui}"`);
    expect(body).toContain(`<w:color w:val="${word(SPECTRUM_HEX.ink)}"/>`);
    expect(body).toContain('<w:sz w:val="21"/>');
    expect(docxIdentifierRunProps()).toContain(`w:ascii="${SPECTRUM_FONTS.mono}"`);
    expect(docxDocDefaultsXml()).toContain(`w:ascii="${SPECTRUM_FONTS.ui}"`);
  });

  it('shades table heads with surface-sunken over a 2px ink rule', () => {
    const head = docxHeaderCellProps();
    expect(head).toContain(`w:fill="${word(SPECTRUM_HEX['surface-sunken'])}"`);
    expect(head).toContain(`w:sz="12" w:space="0" w:color="${DOCX_COLORS.rule}"`);
  });

  it('maps a status to the six Spectrum words and their tones', () => {
    expect(docxStatus('Filed')).toEqual({ word: 'Done', color: word(SPECTRUM_HEX.positive), fill: word(SPECTRUM_HEX['positive-soft']) });
    expect(docxStatus('late').word).toBe('Overdue');
    expect(docxStatus('late').color).toBe(word(SPECTRUM_HEX.danger));
    expect(docxStatus('Pending').color).toBe(word(SPECTRUM_HEX.waiting));
    expect(docxStatus('upcoming').fill).toBe(word(SPECTRUM_HEX['upcoming-soft']));
  });

  it('lists the brand as an accent but not ink or white', () => {
    const accents = spectrumAccentHexes();
    expect(accents).toContain(word(SPECTRUM_HEX.brand));
    expect(accents).not.toContain(word(SPECTRUM_HEX.ink));
    expect(accents).not.toContain('FFFFFF');
  });
});
