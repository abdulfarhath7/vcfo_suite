import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { setRegistrationDates } from '@/db/repositories/credentials';
import { expiresAfterIssue, registrationDate, registrationStepId, renewEveryMonths } from '@/lib/actions/registrations/rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { credentialsError } from '../../client/credentials/_respond';

const body = z
  .object({
    engagementId: z.string().trim().min(1).max(80),
    stepId: registrationStepId,
    issuedOn: registrationDate.nullable(),
    expiresOn: registrationDate.nullable(),
    renewEveryMonths: renewEveryMonths.nullable(),
  })
  .refine(expiresAfterIssue, { message: 'expiry_before_issue', path: ['expiresOn'] });

/**
 * PATCH /api/registrations/dates — staff set the issue date, expiry and renewal period of
 * one registration (G-05). A null clears that field. Writes an audit event; returns the
 * engagement's facts by step id.
 */
export async function PATCH(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const d = parsed.data;
    const facts = await setRegistrationDates(guard.ctx, {
      engagementId: d.engagementId,
      stepId: d.stepId,
      issuedOn: d.issuedOn ?? null,
      expiresOn: d.expiresOn ?? null,
      renewEveryMonths: d.renewEveryMonths ?? null,
    });
    return NextResponse.json({ ok: true, facts });
  } catch (e) {
    return credentialsError(e);
  }
}
