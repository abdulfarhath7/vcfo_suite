import { z } from 'zod';

/** The input rules of a registration's dates, shared by its route and its chat action. */
export const registrationStepId = z.string().regex(/^reg-\d{1,3}$/);

export const registrationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'invalid date');

export const renewEveryMonths = z.number().int().min(1).max(240);

export function expiresAfterIssue(dates: { issuedOn?: string | null; expiresOn?: string | null }): boolean {
  return !dates.issuedOn || !dates.expiresOn || dates.expiresOn > dates.issuedOn;
}
