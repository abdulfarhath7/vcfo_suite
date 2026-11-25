import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { hasDirectorRecord, normalizeDinResponse } from '@/lib/din-lookup/normalize';
import { DIN_REGEX } from '@/lib/din-lookup/validate';
import { falconDomain } from '@/lib/din-lookup/provider';

const FALCON_DIRECTOR_URL = 'https://www.falconebiz.com/api/director_details';

const bodySchema = z.object({
  din: z.string().trim().regex(DIN_REGEX, 'Invalid DIN'),
  refresh: z.boolean().optional(),
});

/**
 * MCA director master data for one DIN, through the FalconeBiz `director_details` API.
 * The key never leaves the server; the browser only ever posts the DIN here. Answers are
 * cached in Postgres for 24 hours, and `refresh` goes past the cache to the provider.
 *
 * MCA publishes the DIN's status, approval date, DIR-3 KYC state and the companies and LLPs
 * the person is on. It does not publish PAN, date of birth, address or contact details, so
 * those still come from the client's own file.
 */
export async function POST(request: Request) {
  const auth = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid DIN. Expected exactly 8 digits.' },
      { status: 400 },
    );
  }

  // The key is the only thing that must be set. The domain falls back to the host the Suite
  // runs on, which is what the provider means by it (see falconDomain).
  const apiKey = process.env.FALCON_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'MCA lookup is not configured. Set FALCON_API_KEY.' },
      { status: 503 },
    );
  }
  const domain = falconDomain();

  if (!body.refresh) {
    try {
      const { getCachedDinLookup } = await import('@/db/repositories/din-lookup');
      const cached = await getCachedDinLookup(auth.ctx, body.din);
      if (cached) {
        return NextResponse.json({
          ok: true,
          data: cached.data,
          cached: true,
          source: cached.source,
          fetchedAt: cached.fetchedAt.toISOString(),
        });
      }
    } catch {
      // Cache miss, or the table is not migrated yet — fall through to the provider.
    }
  }

  try {
    const res = await fetch(process.env.FALCON_DIRECTOR_API_URL ?? FALCON_DIRECTOR_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
        Din: body.din,
        ...(domain ? { Domain: domain } : {}),
      },
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          {
            ok: false,
            error: `The MCA provider rejected our API key, or the domain we sent (${domain || 'none'}). Check FALCON_API_KEY, and set FALCON_API_DOMAIN to the domain registered with FalconeBiz.`,
          },
          { status: 502 },
        );
      }
      if (res.status === 404) {
        return NextResponse.json(
          { ok: false, error: 'No director found on MCA for this DIN. Check the number and try again.' },
          { status: 404 },
        );
      }
      if (res.status === 429) {
        return NextResponse.json(
          { ok: false, error: 'The MCA provider is rate limiting us. Wait a minute and try again.' },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { ok: false, error: `MCA provider returned ${res.status}: ${text.slice(0, 200) || res.statusText}` },
        { status: 502 },
      );
    }

    const raw = (await res.json()) as Record<string, unknown>;

    // The provider reports its own failures inside a 200: credits exhausted, bad domain, and so on.
    const providerError = typeof raw.error === 'string' ? raw.error : typeof raw.message === 'string' ? raw.message : '';
    if (providerError && !raw.din && !raw.name) {
      return NextResponse.json({ ok: false, error: providerError }, { status: 502 });
    }

    const data = normalizeDinResponse(raw, body.din);
    if (!hasDirectorRecord(data)) {
      return NextResponse.json(
        { ok: false, error: 'No director found on MCA for this DIN. Check the number and try again.' },
        { status: 404 },
      );
    }

    try {
      const { saveDinLookup } = await import('@/db/repositories/din-lookup');
      await saveDinLookup(auth.ctx, body.din, data, 'falcon');
    } catch {
      // A cache write failure must not fail the lookup.
    }

    return NextResponse.json({ ok: true, data, cached: false, source: 'falcon', fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return NextResponse.json(
      {
        ok: false,
        error: timedOut
          ? 'MCA did not answer in 30 seconds. The portal is often slow — try again.'
          : `Could not reach the MCA provider: ${message}`,
      },
      { status: 502 },
    );
  }
}
