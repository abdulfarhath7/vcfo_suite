import { NextResponse } from 'next/server';

/**
 * Refuse an upload before its body is read (security review M1): the proxy's
 * body cap does not cover /api/**, and `request.formData()` buffers everything.
 * A missing Content-Length (chunked upload) is refused too, so the cap holds.
 */
export function rejectLargeBody(request: Request, maxBytes: number): NextResponse | null {
  const raw = request.headers.get('content-length');
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return NextResponse.json({ error: 'length_required' }, { status: 411 });
  // multipart framing adds a little on top of the file itself
  if (n > maxBytes + 64 * 1024) return NextResponse.json({ error: 'file_too_large' }, { status: 413 });
  return null;
}
