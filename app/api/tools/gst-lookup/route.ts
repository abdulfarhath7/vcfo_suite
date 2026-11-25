import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { normalizeGstResponse } from '@/lib/gst-lookup/normalize';
import { GSTIN_REGEX } from '@/lib/gst-lookup/validate';

const bodySchema = z.object({
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_REGEX, 'Invalid GSTIN format'),
  refresh: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid GSTIN format. Expected 15-character alphanumeric.' },
      { status: 400 },
    );
  }

  const apiUrl = process.env.GST_API_URL;
  const apiKey = process.env.GST_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { ok: false, error: 'GST API is not configured. Set GST_API_URL and GST_API_KEY environment variables.' },
      { status: 503 },
    );
  }

  // Check DB cache unless refresh is requested
  if (!body.refresh) {
    try {
      const { getCachedLookup } = await import('@/db/repositories/gst-lookup-cache');
      const cached = await getCachedLookup(auth.ctx, body.gstin);
      if (cached) {
        return NextResponse.json({
          ok: true,
          data: cached.data,
          cached: true,
          fetchedAt: cached.fetchedAt.toISOString(),
        });
      }
    } catch {
      // Cache miss or table not yet migrated — proceed to fetch
    }
  }

  try {
    const authScheme = (process.env.GST_API_AUTH_SCHEME ?? 'token').toLowerCase();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authScheme === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (authScheme === 'x-api-key') {
      headers['x-api-key'] = apiKey;
    } else {
      headers['Authorization'] = `Token ${apiKey}`;
    }

    const usesPlaceholder = apiUrl.includes('{gstin}');
    const url = usesPlaceholder
      ? apiUrl.replace('{gstin}', body.gstin)
      : apiUrl;

    const res = await fetch(url, {
      method: usesPlaceholder ? 'GET' : 'POST',
      headers,
      ...(!usesPlaceholder && { body: JSON.stringify({ gstin: body.gstin }) }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: `GST API returned ${res.status}: ${text || res.statusText}` },
        { status: 502 },
      );
    }

    const rawData = await res.json();

    // GSTZen error: subscription exhausted or expired
    if (rawData.status === 0 && rawData.message) {
      return NextResponse.json(
        { ok: false, error: rawData.message },
        { status: 502 },
      );
    }

    // GSTZen error: invalid GSTIN
    if (rawData.valid === false) {
      return NextResponse.json(
        { ok: false, error: 'GSTIN not found on the GST portal. Please check the number and try again.' },
        { status: 404 },
      );
    }

    const data = normalizeGstResponse(rawData);

    // Save to cache
    const now = new Date();
    try {
      const { saveLookup } = await import('@/db/repositories/gst-lookup-cache');
      await saveLookup(auth.ctx, body.gstin, data);
    } catch {
      // Cache write failure is non-fatal
    }

    return NextResponse.json({ ok: true, data, cached: false, fetchedAt: now.toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, error: `Failed to reach GST API: ${message}` },
      { status: 502 },
    );
  }
}
