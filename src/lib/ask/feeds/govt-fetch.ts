import 'server-only';

import { GOVT_FETCH_HEADERS, type FeedContent } from './types';

/**
 * Plain HTTPS reads of government pages and PDFs (ordinary certificate
 * chains — CBIC's incomplete one goes through `govt-https.ts` instead).
 * Browser-like headers: some sites answer bare clients with an error page.
 */
export async function fetchText(url: string, maxBytes = 2 * 1024 * 1024, timeoutMs = 45_000): Promise<string> {
  const res = await fetch(url, {
    headers: { ...GOVT_FETCH_HEADERS, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error(`${new URL(url).host} page is too large to read`);
  return buf.toString('utf8');
}

export async function fetchPdf(url: string, fileName: string, maxBytes = 40 * 1024 * 1024): Promise<FeedContent> {
  const res = await fetch(url, {
    headers: { ...GOVT_FETCH_HEADERS, Accept: 'application/pdf,*/*;q=0.8' },
    signal: AbortSignal.timeout(90_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status} for the file`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error('The file is too large to index');
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('The link did not return a PDF');
  const safe = fileName.replace(/[\\/]/g, '_');
  return { kind: 'file', bytes, fileName: safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`, contentType: 'application/pdf' };
}
