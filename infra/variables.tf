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

# SOC 2 finding #370: false keeps the baked DATABASE_URL secret (no rotation).
# true hands the master password to RDS, which rotates it every 7 days, and the
# app reads it per connection. See database.tf and the cut-over order in
# infra/README.md before turning it on.
variable "db_managed_password" {
  description = "Let RDS manage and rotate the master password (app reads DB_SECRET_ARN)."
  type        = bool
  default     = false
}

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

# Microsoft Graph (lead → client Mail.Send from the lead's Outlook). All three
# must be set together; leave empty to deploy without the Outlook connect flow.
# Azure app "VCFO Suite Outlook": redirect https://<app_domain>/api/outlook/callback.
variable "azure_ad_client_id" {
  description = "Azure app registration Application (client) ID."
  type        = string
  default     = ""
}
variable "azure_ad_tenant_id" {
  description = "Azure Directory (tenant) ID, or \"common\" for multi-tenant."
  type        = string
  default     = ""
}
variable "azure_ad_client_secret" {
  description = "Azure client secret VALUE (not the secret ID). Stored in Secrets Manager; pass via TF_VAR_azure_ad_client_secret or the gitignored tfvars."
  type        = string
  default     = ""
  sensitive   = true
}

# Ask VCFO (in-app assistant). The Anthropic API key is NOT a Terraform
# variable: create the secret by hand (see README "Ask VCFO") so the key
# never enters Terraform state, then flip this on and apply.
variable "ask_vcfo_enabled" {
  description = "Turn on Ask VCFO in App Runner. Requires the Secrets Manager secret named by ask_vcfo_anthropic_secret_name to exist with the API key as its value."
  type        = bool
  default     = false
}
variable "ask_vcfo_features" {
  description = "Ask VCFO proposed features to turn on (any of C1, C2, C3, C4, C5, A1). Each sets ASK_VCFO_FEATURE_<ID>=true; only read when ask_vcfo_enabled is true."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for id in var.ask_vcfo_features : contains(["C1", "C2", "C3", "C4", "C5", "A1"], id)])
    error_message = "ask_vcfo_features entries must be one of C1, C2, C3, C4, C5, A1."
  }
}
variable "ask_vcfo_anthropic_secret_name" {
  description = "Name of the hand-created Secrets Manager secret holding the Anthropic API key (plain string value)."
  type        = string
  default     = "/vcfo/ask-vcfo/anthropic-api-key"
}

# People who may manage the vcfo secrets despite the Deny in database.tf. Exact
# user or role ARNs, no wildcards (the SOC 2 scanner rejects wildcards). Keep
# the Terraform user here, and the SOC scanner user so it can read the policy.
variable "secret_admin_arns" {
  description = "IAM user/role ARNs exempt from the deny-all policy on the vcfo secrets."
  type        = list(string)
  default = [
    "arn:aws:iam::600627321277:user/farhath_vcfo",
    "arn:aws:iam::600627321277:user/sandeep.gaja", # SOC 2 Prowler scanner
  ]
}

