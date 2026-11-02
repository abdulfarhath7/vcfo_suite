import { z } from 'zod';

/** Body shapes for `/api/outlook/groups` and `/api/outlook/groups/:id` (G-23). */
const member = z.object({
  email: z.string().trim().email('invalid_email').max(254),
  name: z.string().trim().max(120).nullable().optional(),
});

export const createMailGroupSchema = z.object({
  name: z.string().trim().min(1, 'name_required').max(80),
  shared: z.boolean().optional(),
  members: z.array(member).min(1, 'members_required').max(200),
});

export const updateMailGroupSchema = z
  .object({
    name: z.string().trim().min(1, 'name_required').max(80).optional(),
    shared: z.boolean().optional(),
    members: z.array(member).min(1, 'members_required').max(200).optional(),
  })
  .refine((v) => v.name !== undefined || v.shared !== undefined || v.members !== undefined, {
    message: 'nothing_to_change',
  });

export const groupIdSchema = z.object({ id: z.string().uuid('invalid_id') });
