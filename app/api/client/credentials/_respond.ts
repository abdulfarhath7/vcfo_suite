import { NextResponse } from 'next/server';
import { CredentialsError } from '@/db/repositories/credentials';

/** Map repository errors to HTTP (shared by every /api/client/credentials route). */
export function credentialsError(e: unknown) {
  if (e instanceof CredentialsError) {
    return NextResponse.json({ ok: false, error: e.code, ...e.extra }, { status: e.status });
  }
  console.error('[credentials] route failed', e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
}

/** Staff open a client's workbook with ?engagementId=; clients never need it. */
export function engagementParam(request: Request): string | null {
  return new URL(request.url).searchParams.get('engagementId')?.trim() || null;
}
