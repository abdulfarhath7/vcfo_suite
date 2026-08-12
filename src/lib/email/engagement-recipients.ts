/**
 * Thin re-export — keep email helpers importing from `@/lib/email/*`
 * while the DB lookup stays in the repository seam.
 */
export {
  resolveEngagementRecipients,
  type EngagementParty,
  type EngagementRecipients,
} from '@/db/repositories/engagement-recipients';
