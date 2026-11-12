import { SPECTRUM_HEX } from '@/lib/doc-style/spectrum-tokens';

/**
 * VCFO Spectrum print palette for the firm-branded PDFs drawn with @react-pdf/renderer (the
 * partner report, the Ask VCFO briefs, the budget PDF). The values are the light-theme hex of
 * docs/design/design-tokens.json via the generated `spectrum-tokens.ts`; no CSS variable or
 * screen-only effect (wash, gradient, shadow) reaches a PDF. Statutory registers and forms do
 * not use this file.
 */
export const PDF_COLORS = {
  ink: SPECTRUM_HEX.ink,
  inkMuted: SPECTRUM_HEX['ink-muted'],
  ink2: SPECTRUM_HEX['ink-2'],
  line: SPECTRUM_HEX.line,
  lineSoft: SPECTRUM_HEX['line-soft'],
  rule: SPECTRUM_HEX.rule,
  headFill: SPECTRUM_HEX['surface-sunken'],
  totalFill: SPECTRUM_HEX.hover,
  brand: SPECTRUM_HEX.brand,
  brandText: SPECTRUM_HEX['brand-text'],
  brandSoft: SPECTRUM_HEX['brand-soft'],
  positive: SPECTRUM_HEX.positive,
  positiveMid: SPECTRUM_HEX['positive-mid'],
  warning: SPECTRUM_HEX.warning,
  danger: SPECTRUM_HEX.danger,
  track: SPECTRUM_HEX['upcoming-soft'],
} as const;

/**
 * react-pdf only knows its built-in faces unless a TTF is registered, and the repo ships no
 * TTF of the Spectrum faces. Helvetica is the metric twin of Arial, the fallback the Word
 * helper declares for the same role.
 */
export const PDF_FONTS = { ui: 'Helvetica', uiBold: 'Helvetica-Bold' } as const;
