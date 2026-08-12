/**
 * Backward-compatible barrel.
 * Prefer `@/lib/email/send-email` for new code.
 */
export {
  sendEmail,
  sendResendEmail,
  formatReplyTo,
  formatFromWithSender,
  defaultReplyToFromEnv,
  resolveEmailDevRedirect,
  resolveResendDevRedirect,
  resolveEmailProvider,
  resolveFromEmail,
  type SendEmailInput,
  type SendEmailResult,
  type SendResendEmailInput,
  type SendResendResult,
  type EmailProvider,
} from '@/lib/email/send-email';
