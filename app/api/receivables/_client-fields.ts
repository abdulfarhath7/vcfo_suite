import { z } from 'zod';

/** The client fields shared by POST /sheets/:id/clients and PATCH /clients/:id (receivables v2). */
export const clientFields = {
  gstin: z.string().max(20, 'gstin').nullable().optional(),
  creditDays: z.number().int().min(0, 'credit_days').max(365, 'credit_days').optional(),
  billingEmail: z.union([z.string().email('email').max(200, 'email'), z.literal(''), z.null()]).optional(),
  billingCc: z.array(z.string().email('email').max(200, 'email')).max(10, 'email').optional(),
  partnerId: z.string().uuid('partner').nullable().optional(),
};
