import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/guards';
import { readServiceConfig } from '@/lib/dev/env-status';
import { firmIntegrations } from '@/lib/firm-settings/integrations';

/**
 * GET /api/firm-settings/integrations — the firm's outside services for the Integrations card
 * on Firm settings (P-241): name, provider, what it does and whether it is set up. The state is
 * read from env var presence only (`readServiceConfig`); no value or env name is returned.
 * Super admin and admin. Each person's own Outlook link is read from `/api/outlook`.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  return NextResponse.json(
    { integrations: firmIntegrations(readServiceConfig()) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
