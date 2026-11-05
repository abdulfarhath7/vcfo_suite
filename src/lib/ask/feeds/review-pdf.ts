import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReviewPdfDocument, type ReviewPdfInput } from './review-pdf-document';

function loadLogo(): string | null {
  try {
    const png = readFileSync(path.join(process.cwd(), 'public', 'sbc-logo-light.png'));
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Pure: earlier instruments this text says it amends ("amend Notification No. 1/2017-Central Tax (Rate)"). */
export function amendedInstruments(text: string): string[] {
  const out = new Set<string>();
  // "amendments in the notification of the Government of India, Ministry of
  // Finance (Department of Revenue), No. 9/2025-Central Tax (Rate)" — up to
  // ~140 characters of issuer wording may sit between "notification" and "No.".
  const re = /amend\w*\s+(?:to\s+|of\s+|in\s+)?(?:the\s+)?(?:said\s+)?(?:notification|circular)s?[^.;]{0,140}?(?:no\.?\s*|number\s+)([0-9]{1,3}\/[0-9]{4}(?:[^,.;\n]{0,40})?)/gi;
  for (const m of text.matchAll(re)) {
    const ref = m[1]!.replace(/\s+/g, ' ').trim();
    if (ref) out.add(ref);
    if (out.size >= 6) break;
  }
  return [...out];
}

/** Pure: "shall come into force on the 1st day of May, 2026" / "with effect from 1st May 2026" → that phrase. */
export function effectiveFromPhrase(text: string): string | null {
  const re = /(?:come into (?:force|effect)|with effect from|effective from|w\.e\.f\.?)\s*(?:on|from)?\s*(?:the\s+)?([0-9]{1,2}(?:st|nd|rd|th)?\s*(?:day\s+of\s+)?[A-Za-z]+,?\s*[0-9]{4})/i;
  const m = re.exec(text);
  return m ? m[1]!.replace(/\s+/g, ' ').trim() : null;
}

const DEVANAGARI = /[ऀ-ॿ]/g;

/**
 * Characters outside basic Latin, common dashes/quotes, the rupee sign and Hindi (Devanagari) —
 * a garbled read has many. Hindi is left out because every gazette is printed in Hindi and English.
 */
function nonLatinCount(text: string): number {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c > 0x7f && !(c >= 0x2010 && c <= 0x2027) && c !== 0x20b9 && !(c >= 0x0900 && c <= 0x097f)) n += 1;
  }
  return n;
}

/**
 * Pure: the opening of the original text for the review PDF. The PDF's built-in font has no Hindi
 * letters or rupee sign, so lines that are mostly Hindi (the first half of a bilingual gazette)
 * are dropped and ₹ becomes "Rs.".
 */
export function latinExcerpt(text: string, max: number): string {
  const english = text
    .split(/\r?\n/)
    .filter((line) => (line.match(DEVANAGARI) ?? []).length <= (line.match(/[A-Za-z]/g) ?? []).length)
    .join(' ')
    .replace(DEVANAGARI, '')
    .replace(/₹\s*/g, 'Rs. ')
    .replace(/\s+/g, ' ')
    .trim();
  return english.length > max ? `${english.slice(0, max)} …` : english;
}

/** Pure: a reading-quality verdict for the manager. */
export function readingCheck(text: string, pieces: number): ReviewPdfInput['reading'] {
  const words = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
  let warning: string | null = null;
  if (words < 60) warning = 'Very little text was read. The file may be a scan or an image; open the original and compare.';
  else if (/�/.test(text) || nonLatinCount(text) > words) {
    warning = 'The text contains many unreadable characters. Check that the summary matches the original.';
  }
  return { characters: text.length, pieces, words, warning };
}

export async function renderReviewPdf(
  input: Omit<ReviewPdfInput, 'logo' | 'generatedOn' | 'amends' | 'effectiveFrom' | 'reading' | 'excerpt'> & {
    text: string;
    pieces: number;
    now?: Date;
  },
): Promise<Buffer> {
  const generatedOn = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(input.now ?? new Date());
  const full: ReviewPdfInput = {
    firmName: input.firmName,
    logo: loadLogo(),
    generatedOn: `${generatedOn} IST`,
    sourceLabel: input.sourceLabel,
    act: input.act,
    title: input.title,
    number: input.number,
    kind: input.kind,
    publishedAt: input.publishedAt,
    sourceUrl: input.sourceUrl,
    summary: input.summary,
    amends: amendedInstruments(input.text),
    effectiveFrom: effectiveFromPhrase(input.text),
    reading: readingCheck(input.text, input.pieces),
    excerpt: latinExcerpt(input.text, 1600),
  };
  return renderToBuffer(createElement(ReviewPdfDocument, { input: full }) as Parameters<typeof renderToBuffer>[0]);
}
