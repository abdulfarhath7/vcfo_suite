import { statusWord, toneFor, type ChipTone } from '@/components/ui/spectrum-chip';
import { SPECTRUM_FONTS, SPECTRUM_HEX, type SpectrumColor } from '@/lib/doc-style/spectrum-tokens';

/**
 * VCFO Spectrum styling for firm-branded Word files (cover letters, checklists, summaries,
 * packs, reports). Statutory and filing documents (MoA, AoA, INC-9, DIR-2, DIR-8, declarations,
 * board resolutions, NOCs, the board-meeting notice) must NOT use this: their layout is the one
 * MCA and the Secretarial Standards expect. The list of which document is which is in
 * docs/context/notes/incorporation-docs.md, "Spectrum styling".
 *
 * Every value comes from `spectrum-tokens.ts`, which is generated from
 * docs/design/design-tokens.json; nothing here hard-codes a colour or a font name.
 *
 * Fonts are not embedded. A reader without the Spectrum faces gets the fallback that the
 * font table declares (`w:altName`), so a Word file built with `docxFontTableXml()` opens in
 * Arial and Consolas rather than in Times New Roman.
 */

/** A Spectrum colour as Word writes it: six upper-case hex digits, no `#`. */
export function docxColor(name: SpectrumColor): string {
  return SPECTRUM_HEX[name].slice(1).toUpperCase();
}

export type DocxFontRole = 'ui' | 'mono';

/** The face for each role and the installed font Word falls back to. */
export const DOCX_FONTS: Record<DocxFontRole, { name: string; fallback: string; family: 'swiss' | 'modern'; pitch: 'variable' | 'fixed' }> = {
  ui: { name: SPECTRUM_FONTS.ui, fallback: 'Arial', family: 'swiss', pitch: 'variable' },
  mono: { name: SPECTRUM_FONTS.mono, fallback: 'Consolas', family: 'modern', pitch: 'fixed' },
};

/** Text colours, rules and fills used by Spectrum documents. */
export const DOCX_COLORS = {
  /** Body text and figures. */
  ink: docxColor('ink'),
  /** Captions, meta lines, table head text. */
  inkMuted: docxColor('ink-muted'),
  /** Headings: ink, the brand is never a text colour for prose. */
  heading: docxColor('ink'),
  /** Links and the one accent word per section. */
  brandText: docxColor('brand-text'),
  /** 2px structural rule under page heads and table heads, above totals. */
  rule: docxColor('rule'),
  /** Hairline around tables and between rows. */
  line: docxColor('line'),
  lineSoft: docxColor('line-soft'),
  /** Table header row ground. */
  headFill: docxColor('surface-sunken'),
} as const;

/** `<w:rFonts>` for a role. All four script slots name the face, so no slot falls back to the theme font. */
export function docxRunFonts(role: DocxFontRole = 'ui'): string {
  const f = DOCX_FONTS[role].name;
  return `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>`;
}

export interface DocxRunStyle {
  role?: DocxFontRole;
  /** A key of DOCX_COLORS; defaults to ink. */
  color?: keyof typeof DOCX_COLORS;
  bold?: boolean;
  /** Size in points. */
  pt?: number;
}

/** `<w:rPr>` for a Spectrum run, children in schema order (fonts, bold, colour, size). */
export function docxRunProps(style: DocxRunStyle = {}): string {
  const half = style.pt ? Math.round(style.pt * 2) : null;
  return [
    '<w:rPr>',
    docxRunFonts(style.role),
    style.bold ? '<w:b/><w:bCs/>' : '',
    `<w:color w:val="${DOCX_COLORS[style.color ?? 'ink']}"/>`,
    half ? `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>` : '',
    '</w:rPr>',
  ].join('');
}

/** Run props for an identifier (CIN, DIN, PAN, SRN): the mono face in ink. */
export function docxIdentifierRunProps(pt?: number): string {
  return docxRunProps({ role: 'mono', pt });
}

/** Run props for a heading: the ui face, bold, ink. */
export function docxHeadingRunProps(pt = 14): string {
  return docxRunProps({ bold: true, pt });
}

/** Border widths in eighths of a point: the 2px rule (1.5pt) and the 1.5px hairline (about 1pt). */
const BORDER_SZ = { rule: 12, hairline: 8 } as const;

/** One border element, e.g. `docxBorder('bottom', 'rule')` inside `<w:pBdr>` or `<w:tcBorders>`. */
export function docxBorder(side: 'top' | 'bottom' | 'left' | 'right' | 'insideH' | 'insideV', weight: keyof typeof BORDER_SZ = 'hairline'): string {
  const color = weight === 'rule' ? DOCX_COLORS.rule : DOCX_COLORS.line;
  return `<w:${side} w:val="single" w:sz="${BORDER_SZ[weight]}" w:space="0" w:color="${color}"/>`;
}

/** `<w:tblBorders>` for a Spectrum table: hairline frame and rows, no inner columns. */
export function docxTableBorders(): string {
  return `<w:tblBorders>${docxBorder('top')}${docxBorder('left')}${docxBorder('bottom')}${docxBorder('right')}${docxBorder('insideH')}<w:insideV w:val="nil"/></w:tblBorders>`;
}

/** `<w:tcPr>` children for a header cell: sunken ground and the 2px ink rule beneath. */
export function docxHeaderCellProps(): string {
  return `<w:tcBorders>${docxBorder('bottom', 'rule')}</w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${DOCX_COLORS.headFill}"/>`;
}

/** Spectrum chip tones as Word colours: the word in the tone, on the tone's soft ground. */
const TONE_TOKENS: Record<ChipTone, [SpectrumColor, SpectrumColor]> = {
  ok: ['positive', 'positive-soft'],
  warn: ['warning', 'warning-soft'],
  bad: ['danger', 'danger-soft'],
  prog: ['brand-text', 'brand-soft'],
  idle: ['upcoming', 'upcoming-soft'],
  violet: ['identity', 'identity-soft'],
  teal: ['waiting', 'waiting-soft'],
};

/**
 * A status as the Spectrum chip shows it (R-13): one of the six words, its text colour and
 * its ground, so a Word table cell reads the same as the app.
 */
export function docxStatus(status: string): { word: string; color: string; fill: string } {
  const word = statusWord(status);
  const [text, ground] = TONE_TOKENS[toneFor(word)];
  return { word, color: docxColor(text), fill: docxColor(ground) };
}

/**
 * `word/fontTable.xml` declaring the Spectrum faces with their fallbacks. Add it to the
 * package with a `fontTable` relationship from `word/_rels/document.xml.rels`.
 */
export function docxFontTableXml(): string {
  const fonts = Object.values(DOCX_FONTS)
    .map(
      (f) =>
        `<w:font w:name="${f.name}"><w:altName w:val="${f.fallback}"/><w:charset w:val="00"/><w:family w:val="${f.family}"/><w:pitch w:val="${f.pitch}"/></w:font>` +
        `<w:font w:name="${f.fallback}"><w:charset w:val="00"/><w:family w:val="${f.family}"/><w:pitch w:val="${f.pitch}"/></w:font>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${fonts}</w:fonts>`;
}

/** Document defaults for `word/styles.xml`: Spectrum ui face in ink, so unstyled runs follow the system. */
export function docxDocDefaultsXml(pt = 10.5): string {
  return `<w:docDefaults><w:rPrDefault>${docxRunProps({ pt })}</w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`;
}

/**
 * Colours a firm-branded document may carry and a statutory one must not: every Spectrum
 * colour except the neutrals that already appear on plain printed forms (white, and the ink
 * navy the statutory rule allows for body text). Tests use it to keep statutory files clean.
 */
export function spectrumAccentHexes(): string[] {
  const allowed = new Set<string>([SPECTRUM_HEX['surface-raised'], SPECTRUM_HEX.ink]);
  return [...new Set(Object.values(SPECTRUM_HEX))].filter((h) => !allowed.has(h)).map((h) => h.slice(1).toUpperCase());
}
