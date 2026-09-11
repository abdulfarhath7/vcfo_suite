variable "region" {
  default = "ap-south-1" # Mumbai — Indian data residency
}
variable "project" {
  default = "vcfo-suite"
}
variable "db_username" {
  default   = "vcfo"
  sensitive = true
}
# The DB password is generated (random_password) and stored in Secrets Manager
# as part of DATABASE_URL — never passed on the command line.

variable "alert_emails" {
  description = "Recipients for the AWS Budgets alerts ($10 / $25 thresholds)."
  type        = list(string)
}

variable "email_from" {
  description = "SES From header, e.g. \"VCFO Suite <noreply@example.com>\". Address must be on a verified SES identity."
  type        = string
}

variable "ses_identity" {
  description = "Domain or email address to verify in SES for var.email_from. Leave empty if the identity is already verified in this account/region."
  type        = string
  default     = ""
}

variable "site_url" {
  description = "Public HTTPS origin of the app (App Runner default URL or custom domain). Empty on the very first apply — the URL does not exist yet; set it and re-apply."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "ECR image tag App Runner deploys. With auto_deployments_enabled a new push to this tag redeploys."
  type        = string
  default     = "latest"
}

variable "app_cpu" {
  default = "1024" # 1 vCPU
}
variable "app_memory" {
  default = "2048" # 2 GB — Next.js server + docx generation headroom
}

variable "app_domain" {
  description = "Custom hostname for App Runner (e.g. app.sbctrack.in). Empty = default awsapprunner.com URL only. Set site_url to https://<app_domain> only after the association is ACTIVE."
  type        = string
  default     = ""
}
