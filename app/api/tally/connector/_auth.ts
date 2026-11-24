import { NextResponse } from 'next/server';
import { connectorByToken, type ConnectorRow } from '@/db/repositories/receivables';

/**
 * Tally connector routes (docs/specs/receivables/TALLY-LIVE.md) have no user session. Every call
 * but /pair sends `Authorization: Bearer tc_…`; an unknown or revoked token gets 401 `revoked`,
 * which tells the connector to ask for a new pairing code.
 */
export async function connectorFrom(request: Request): Promise<{ ok: true; connector: ConnectorRow } | { ok: false; response: NextResponse }> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const connector = await connectorByToken(token).catch(() => null);
  if (!connector) return { ok: false, response: NextResponse.json({ error: 'revoked' }, { status: 401 }) };
  return { ok: true, connector };
}

export function serverError(where: string, e: unknown) {
  console.error(`[tally-connector] ${where} failed`, e instanceof Error ? e.message : e);
  return NextResponse.json({ error: 'server_error' }, { status: 500 });
}
