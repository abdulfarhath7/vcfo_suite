/**
 * Re-export shared API validation helpers and schemas.
 */
export { parseJsonBody, type ParseBodyFailure } from '@/lib/api/parse-body';
export {
  engagementStageSchema,
  engagementHealthSchema,
  internIdSchema,
} from '@/lib/api/engagement-schemas';
export {
  emailSchema,
  clientPasswordSchema,
  companyNameSchema,
  welcomeEmailBodySchema,
  resendWelcomeEmailBodySchema,
  createProjectBodySchema,
} from '@/lib/api/schemas';
