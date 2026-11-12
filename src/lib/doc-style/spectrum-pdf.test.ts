// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The firm-branded PDFs (class (b) in docs/context/notes/incorporation-docs.md) take every
 * colour and face from `spectrum-pdf.ts`. A literal hex in their style sheets means a colour
 * escaped the Spectrum palette.
 */
const BRANDED_PDFS = [
  'src/lib/reports/partner-report-document.tsx',
  'src/lib/ask/pdf-brief-document.tsx',
  'src/lib/ask/pdf-status-brief-document.tsx',
  'src/lib/budget/pdf.tsx',
];

describe('firm-branded PDFs use the Spectrum print palette', () => {
  it.each(BRANDED_PDFS)('%s', (file) => {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(src).toContain("from '@/lib/doc-style/spectrum-pdf'");
    expect(src).not.toMatch(/['"`]#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/fontFamily: '/);
  });
});
