import 'server-only';

/**
 * What a PDF holds, page by page (PLAN M6). A page with text is read as text, for free; a page that
 * is a picture of paper (a scan) has almost no text and an image on it. The two kinds are told apart
 * the way the knowledge library tells them (`ask/ingest/extract.ts`): little text and an image.
 *
 * A scanned page is sent to the model as a picture of that one page, rendered locally, so a long
 * scan is read a few pages at a time and never as one request over the API's size limit. When the
 * renderer is not available the caller sends the whole PDF and names the pages to read.
 */

/** A page with less text than this and an image on it is a scan. */
export const SCAN_MAX_CHARS = 40;
/** At most this many scanned pages of one file are read; the rest are listed as skipped. */
export const SCAN_MAX_PAGES = 30;
/** Scanned pages sent in one model call. */
export const SCAN_PAGES_PER_CALL = 5;
/** Above this size a whole PDF is not sent as one document; only rendered pages are. */
export const WHOLE_PDF_MAX_BYTES = 20 * 1024 * 1024;
const RENDER_WIDTH = 1400;

export interface PdfLayout {
  /** Every page's text, one string per page. */
  pages: string[];
  /** One-based numbers of the scanned pages, in order. */
  scanned: number[];
}

export class PdfUnreadable extends Error {
  constructor() {
    super('This file is not a readable PDF.');
    this.name = 'PdfUnreadable';
  }
}

export async function pdfLayout(data: Buffer): Promise<PdfLayout> {
  const { extractText, getDocumentProxy, inspectPages } = await import('unpdf');
  let pages: string[];
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js takes over the buffer it is given, so it gets its own copy.
    pdf = await getDocumentProxy(new Uint8Array(data));
    pages = (await extractText(pdf, { mergePages: false })).text;
  } catch {
    throw new PdfUnreadable();
  }
  let scanned: number[];
  try {
    const inspected = await inspectPages(pdf);
    scanned = inspected.pages.flatMap((p, i) => ((pages[i] ?? '').trim().length < SCAN_MAX_CHARS && p.imageCount > 0 ? [i + 1] : []));
  } catch {
    // Without the inspection, a page with almost no text counts as a scan.
    scanned = pages.flatMap((page, i) => (page.trim().length < SCAN_MAX_CHARS ? [i + 1] : []));
  }
  return { pages, scanned };
}

/**
 * The scanned pages as JPEG pictures, in the order asked. Null when the renderer cannot run here,
 * so the caller falls back to sending the whole PDF.
 */
export async function renderPdfPages(data: Buffer, pageNumbers: readonly number[]): Promise<Array<{ page: number; jpeg: Buffer }> | null> {
  if (pageNumbers.length === 0) return [];
  try {
    const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const out: Array<{ page: number; jpeg: Buffer }> = [];
    for (const page of pageNumbers) {
      const image = await renderPageAsImage(pdf, page, {
        canvasImport: () => import('@napi-rs/canvas'),
        width: RENDER_WIDTH,
        format: 'jpeg',
        quality: 0.8,
      });
      out.push({ page, jpeg: Buffer.from(image) });
    }
    return out;
  } catch (error) {
    console.warn('[ask-vcfo] scanned pages could not be rendered; the whole PDF is sent', error instanceof Error ? error.message.slice(0, 200) : error);
    return null;
  }
}

/** Splits pages into groups for one model call each. */
export function pageGroups<T>(items: readonly T[], size = SCAN_PAGES_PER_CALL): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
