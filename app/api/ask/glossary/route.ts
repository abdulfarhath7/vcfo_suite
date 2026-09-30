import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { GLOSSARY } from '@/data/ask/glossary';
import { requireAsk } from '@/lib/ask/route-guard';

const BODY = JSON.stringify({ terms: GLOSSARY });
const ETAG = `"${createHash('sha1').update(BODY).digest('hex').slice(0, 16)}"`;

/** GET /api/ask/glossary — underline terms (static per deploy, ETag-cached). */
export async function GET(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const headers = { ETag: ETAG, 'Cache-Control': 'private, max-age=3600' };
  if (request.headers.get('if-none-match') === ETAG) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(BODY, { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
}
