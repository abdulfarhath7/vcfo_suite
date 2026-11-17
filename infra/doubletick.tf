# Receivables v2 (docs/specs/receivables/V2.md): the WhatsApp ping to the sender of each
# receivables email goes through DoubleTick, the firm's WhatsApp number. Same pattern as the
# credentials key (soc-runtime.tf): Terraform makes the empty secret, the owner puts the API key
# in it by hand (the value never enters Terraform state), then turns doubletick_enabled on.
# App Runner refuses to start when a referenced secret has no value, so put the value first:
#   terraform apply -target=aws_secretsmanager_secret.doubletick_api_key -target=aws_secretsmanager_secret_policy.doubletick_api_key
#   aws secretsmanager put-secret-value --secret-id vcfo-suite/DOUBLETICK_API_KEY --secret-string "$DT_KEY"
#   terraform apply
#
# Production (17 Nov 2026): the secret vcfo-suite/DOUBLETICK_API_KEY and its lockdown policy were
# made by hand, then imported into Terraform state the same evening; terraform.tfvars was aligned
# with production (Ask VCFO on the Anthropic API) so a plan shows no drift. soc-runtime.tf now
# grants the app role the key; the hand-made inline policy vcfo-suite-app-doubletick was deleted
# after the apply.

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
