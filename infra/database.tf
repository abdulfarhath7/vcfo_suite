# RDS Postgres in Mumbai, KMS-encrypted. Same Postgres your app used locally.
resource "aws_kms_key" "db" {
  description         = "${var.project} RDS encryption"
  enable_key_rotation = true
}

# Rotating password (SOC 2 finding #370). With var.db_managed_password = false
# (the default) nothing changes: the password below is baked into the
# DATABASE_URL secret and never rotates. With true, RDS keeps the master
# password in its own Secrets Manager secret and rotates it every 7 days; the
# app reads that secret per new connection (src/db/client.ts, DB_SECRET_ARN),
# and the DATABASE_URL secret is deleted (7-day recovery window). Cut-over
# order is in infra/README.md: ship an image with the new client.ts first,
# then flip the flag at night, then test with rotate-secret.
#
# The flag takes two applies. The AWS provider only learns the master secret's
# ARN after RDS has created it, so the first apply switches RDS alone, and
# local.db_rotating turns true on the second apply, which moves the app over,
# locks the new secret down and deletes DATABASE_URL. Run them back to back:
# between the two, new connections fail because the old password is gone.
locals {
  db_master_secret_arn = try(aws_db_instance.postgres.master_user_secret[0].secret_arn, "")
  db_rotating          = var.db_managed_password && local.db_master_secret_arn != ""
}

# URL-safe on purpose: the password is embedded in DATABASE_URL unescaped.
# Kept with the flag on, unused, so turning the flag off again has a value.
resource "random_password" "db" {
  length  = 32
  special = false
}

# Pilot posture is a public endpoint, so TLS is mandatory, not optional.
resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project}-pg16"
  family = "postgres16"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot" # static parameter; AWS reports it this way
  }
}

resource "aws_db_instance" "postgres" {
  identifier                  = "${var.project}-db"
  engine                      = "postgres"
  engine_version              = "16"
  instance_class              = "db.t4g.micro" # scale up when you have paying customers
  allocated_storage           = 20
  storage_type                = "gp3"
  storage_encrypted           = true
  kms_key_id                  = aws_kms_key.db.arn
  username                    = var.db_username
  password                    = var.db_managed_password ? null : random_password.db.result
  manage_master_user_password = var.db_managed_password ? true : null
  # Switch the password now, not in the maintenance window, so apply 2 can follow at once.
  apply_immediately            = var.db_managed_password
  db_name                      = "vcfo"
  parameter_group_name         = aws_db_parameter_group.postgres.name
  db_subnet_group_name         = aws_db_subnet_group.postgres.name
  vpc_security_group_ids       = [aws_security_group.db.id]
  publicly_accessible          = !var.db_private # private-db.tf
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${var.project}-db-final"
  backup_retention_period      = 7
  copy_tags_to_snapshot        = true  # otherwise backup storage bills untagged
  multi_az                     = false # set true for HA once in production
  deletion_protection          = true
  auto_minor_version_upgrade   = true
  performance_insights_enabled = false # not in the free tier for t4g.micro
}

# Connection string the app reads at runtime, injected by App Runner from
# Secrets Manager — never in git, never in the image.
# Only until the app has moved to the rotating password (local.db_rotating).
# The moved blocks keep the existing secret in place now that it has a count.
resource "aws_secretsmanager_secret" "database_url" {
  count                   = local.db_rotating ? 0 : 1
  name                    = "${var.project}/DATABASE_URL"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database_url" {
  count         = local.db_rotating ? 0 : 1
  secret_id     = aws_secretsmanager_secret.database_url[0].id
  secret_string = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${aws_db_instance.postgres.db_name}?sslmode=require"
}

moved {
  from = aws_secretsmanager_secret.database_url
  to   = aws_secretsmanager_secret.database_url[0]
}

moved {
  from = aws_secretsmanager_secret_version.database_url
  to   = aws_secretsmanager_secret_version.database_url[0]
}

# Auth.js session signing secret. Generated once. M7: rotating it no longer signs
# anyone out; follow docs/context/AWS-DEPLOY.md §11.1 (AUTH_SECRET_PREVIOUS).
resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "auth_secret" {
  name                    = "${var.project}/AUTH_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "auth_secret" {
  secret_id     = aws_secretsmanager_secret.auth_secret.id
  secret_string = random_password.auth_secret.result

  # M7: AUTH_SECRET is rotated by hand every 90 days (SOC 2 exception 371) with
  # put-secret-value. Without this, the next apply would put the old value back.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Azure client secret for the Outlook Graph connect flow. Only created when the
# three azure_ad_* vars are set (see variables.tf). M7: rotate it with
# put-secret-value (AWS-DEPLOY.md §11.1); the app reads it at runtime, so no
# apply or redeploy is needed, and user connections keep working.
locals {
  outlook_enabled = var.azure_ad_client_id != "" && var.azure_ad_tenant_id != "" && var.azure_ad_client_secret != ""
}

resource "aws_secretsmanager_secret" "azure_ad_client_secret" {
  count                   = local.outlook_enabled ? 1 : 0
  name                    = "${var.project}/AZURE_AD_CLIENT_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "azure_ad_client_secret" {
  count         = local.outlook_enabled ? 1 : 0
  secret_id     = aws_secretsmanager_secret.azure_ad_client_secret[0].id
  secret_string = var.azure_ad_client_secret

  # M7: rotated by hand every 6 months (SOC 2 exception 372) with put-secret-value;
  # the app reads it at runtime. The tfvar seeds the first value only.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Ask VCFO: the Anthropic API key lives in a secret created by hand in the
# console (value never in Terraform state). Looked up only when enabled, so a
# plan without the secret still works.
data "aws_secretsmanager_secret" "anthropic_api_key" {
  count = var.ask_vcfo_enabled ? 1 : 0
  name  = var.ask_vcfo_anthropic_secret_name
}

# Resource policy on every vcfo secret (SOC 2 finding: restrictive resource
# policy). The account is shared with other teams, so an explicit Deny keeps
# everyone out except the app role and the people in var.secret_admin_arns.
# The deny ignores IAM grants, so keep the Terraform user in that list or the
# next apply cannot read or change these secrets.
locals {
  vcfo_secret_arns = merge(
    { auth_secret = aws_secretsmanager_secret.auth_secret.arn },
    local.db_rotating ? { db_master = local.db_master_secret_arn } : { database_url = aws_secretsmanager_secret.database_url[0].arn },
    local.outlook_enabled ? { azure_ad_client_secret = aws_secretsmanager_secret.azure_ad_client_secret[0].arn } : {},
    var.ask_vcfo_enabled ? { anthropic_api_key = data.aws_secretsmanager_secret.anthropic_api_key[0].arn } : {},
  )
}

data "aws_iam_policy_document" "secret_lockdown" {
  statement {
    sid       = "DenyAllButVcfo"
    effect    = "Deny"
    actions   = ["secretsmanager:*"]
    resources = ["*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "StringNotEquals"
      variable = "aws:PrincipalArn"
      values   = concat([aws_iam_role.app.arn], var.secret_admin_arns)
    }
  }
}

resource "aws_secretsmanager_secret_policy" "vcfo" {
  for_each   = nonsensitive(local.vcfo_secret_arns) # ARNs only; outlook_enabled reads a sensitive var
  secret_arn = each.value
  policy     = data.aws_iam_policy_document.secret_lockdown.json
}
