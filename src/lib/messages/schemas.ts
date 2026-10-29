import { z } from 'zod';
import { MESSAGE_BODY_MAX, MESSAGE_TRIAGE, MESSAGE_TRIAGE_FILTER } from '@/lib/messages/types';

/** Request bodies for the message routes (`app/api/client/messages`, `app/api/messages`). */

/** An item key as built by `src/lib/work/item-key.ts`: a known kind, a colon, then the id. */
export const itemKeySchema = z
  .string()
  .trim()
  .max(240)
  .regex(/^(step|filing|event|request|task):\S+$/, 'Invalid item key');

export const postMessageSchema = z.object({
  engagementId: z.string().trim().min(1, 'engagementId is required').max(120),
  body: z.string().trim().min(1, 'Write a message').max(MESSAGE_BODY_MAX, 'Message is too long'),
  itemKey: itemKeySchema.nullish(),
});

export const triagePatchSchema = z.object({
  triage: z.enum(MESSAGE_TRIAGE),
});

export const triageFilterSchema = z.enum(MESSAGE_TRIAGE_FILTER);
