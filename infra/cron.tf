# Receivables approval (owner, 20 Nov 2026): the hourly clock. App Runner has no clock of its own and
# the Inngest crons never ran in production (no Inngest keys), so an AWS EventBridge rule calls
# POST https://app.sbctrack.in/api/cron/receivables at :05 IST with the header x-cron-secret. The
# route prepares the roll-up and digest that are due (they wait for approval) and sends no email.
#
# Terraform makes the empty secret and lets the app read it; the value is put by hand so it never
# enters Terraform state, the same as the DoubleTick key:
#   terraform apply -target=aws_secretsmanager_secret.cron_secret
#   aws secretsmanager put-secret-value --secret-id vcfo-suite/CRON_SECRET --secret-string "$(openssl rand -hex 32)"
#   terraform apply
# The EventBridge side holds the same value, so it is made with the AWS CLI, not Terraform:
#   connection   vcfo-receivables-cron  (API key header x-cron-secret)
#   destination  vcfo-receivables-cron  POST https://app.sbctrack.in/api/cron/receivables
#   role         vcfo-receivables-cron  (events:InvokeApiDestination on that destination)
#   rule         vcfo-receivables-cron  cron(35 * * * ? *)  = :05 IST every hour
# Production (20 Nov 2026): all four were made that way; see docs/context/notes/aws.md.

variable "cron_enabled" {
  description = "Inject vcfo-suite/CRON_SECRET into App Runner for the hourly receivables clock."
  type        = bool
  default     = false
}

resource "aws_secretsmanager_secret" "cron_secret" {
  count                   = var.cron_enabled ? 1 : 0
  name                    = "${var.project}/CRON_SECRET"
  recovery_window_in_days = 7
}

locals {
  cron_secrets = var.cron_enabled ? { CRON_SECRET = aws_secretsmanager_secret.cron_secret[0].arn } : {}
}
