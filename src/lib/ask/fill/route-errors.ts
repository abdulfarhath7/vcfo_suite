import 'server-only';

import { NextResponse } from 'next/server';
import { changesetRefusal } from '@/lib/ask/changeset/route-errors';
import { FillRefused } from './run';

/** The fill routes' answer to a refusal: a FillRefused says why, the rest maps like the card routes. */
export function fillRefusal(error: unknown): NextResponse {
  if (error instanceof FillRefused) return NextResponse.json({ error: error.message }, { status: error.status });
  return changesetRefusal(error);
}

/** Staff only: a client never starts or reads a fill. */
export const clientRefused = () => NextResponse.json({ error: 'Fill into app is for staff.' }, { status: 403 });
