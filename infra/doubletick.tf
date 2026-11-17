# Receivables v2 (docs/specs/receivables/V2.md): the WhatsApp ping to the sender of each
# receivables email goes through DoubleTick, the firm's WhatsApp number. Same pattern as the
# credentials key (soc-runtime.tf): Terraform makes the empty secret, the owner puts the API key
# in it by hand (the value never enters Terraform state), then turns doubletick_enabled on.
# App Runner refuses to start when a referenced secret has no value, so put the value first:
#   terraform apply -target=aws_secretsmanager_secret.doubletick_api_key -target=aws_secretsmanager_secret_policy.doubletick_api_key
#   aws secretsmanager put-secret-value --secret-id vcfo-suite/DOUBLETICK_API_KEY --secret-string "$DT_KEY"
#   terraform apply
#
# Production (17 Nov 2026): the secret vcfo-suite/DOUBLETICK_API_KEY, its lockdown policy, the
# inline role policy vcfo-suite-app-doubletick and the App Runner env vars were set by hand with
# the AWS CLI, because a full apply would also have moved Ask VCFO from the Anthropic API to
# Bedrock (live drift). Before the next apply, import the secret and its policy:
#   terraform import 'aws_secretsmanager_secret.doubletick_api_key[0]' <secret ARN>
#   terraform import 'aws_secretsmanager_secret_policy.doubletick_api_key[0]' <secret ARN>
# and delete the hand-made inline policy vcfo-suite-app-doubletick (soc-runtime.tf grants it).

variable "doubletick_enabled" {
  description = "Inject vcfo-suite/DOUBLETICK_API_KEY and the DoubleTick settings into App Runner."
  type        = bool
  default     = false
}

variable "doubletick_from_number" {
  description = "The firm's WhatsApp Business number on DoubleTick, for example +919014079600."
  type        = string
  default     = ""
}

variable "doubletick_receivables_template" {
  description = "The approved DoubleTick template of the receivables ping (vcfo_receivables_email_sent)."
  type        = string
  default     = ""
}

resource "aws_secretsmanager_secret" "doubletick_api_key" {
  count                   = var.doubletick_enabled ? 1 : 0
  name                    = "${var.project}/DOUBLETICK_API_KEY"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_policy" "doubletick_api_key" {
  count      = var.doubletick_enabled ? 1 : 0
  secret_arn = aws_secretsmanager_secret.doubletick_api_key[0].arn
  policy     = data.aws_iam_policy_document.secret_lockdown.json
}

locals {
  doubletick_env = var.doubletick_enabled ? {
    DOUBLETICK_FROM_NUMBER                     = var.doubletick_from_number
    DOUBLETICK_TEMPLATE_LANG                   = "en"
    DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT = var.doubletick_receivables_template
  } : {}
  doubletick_secrets = var.doubletick_enabled ? { DOUBLETICK_API_KEY = aws_secretsmanager_secret.doubletick_api_key[0].arn } : {}
}
