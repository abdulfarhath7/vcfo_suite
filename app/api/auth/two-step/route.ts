import { NextResponse } from 'next/server';
import { z } from 'zod';
import { systemCheckSignInPassword } from '@/db/repositories/profiles';
import { parseJsonBody } from '@/lib/api/parse-body';

const bodySchema = z.object({
  email: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(128),
});

/**
 * POST /api/auth/two-step — the sign-in screen's pre-check (G-25), public.
 *
 * Says whether the sign-in will need a two-step code. `codeRequired` is true
 * only when the email and password are right AND that person has two-step on;
 * a wrong password and an unknown email both answer false, so the route never
 * tells whether an email exists. The password is checked again by Auth.js in
 * `authorize`, which is the real gate. This route signs nobody in.
 */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: 400 });
  const person = await systemCheckSignInPassword(body.data.email, body.data.password);
  return NextResponse.json({ codeRequired: Boolean(person?.twoStepOn) });
}
