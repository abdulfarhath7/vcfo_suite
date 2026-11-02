# M7: read-only grants for the developer console's SOC 2 cards (Access > Secrets and
# rotation, Data and costs > Backups and Network), the optional AUTH_SECRET_PREVIOUS
# secret for rotation without sign-outs, and the optional CREDENTIALS_ENCRYPTION_KEY
# secret (portal credentials and, since M7, two-step secrets).
#
# Every action here is a Describe/Get/List call. Nothing can change a secret, a backup,
# the network or the database. Resources are scoped to vCFO ARNs where the service allows
# it; EC2 Describe* has no resource-level permissions, so it is limited to this region.
# Without these grants each card shows "Not connected"; the app keeps working.
#
# This file does not touch any SOC control: RDS stays private, no security group or
# CIDR changes, and the deny-all resource policy covers the new secret too.

data "aws_iam_policy_document" "app_console_soc_read" {
  statement {
    sid       = "SecretsDescribe"
    actions   = ["secretsmanager:DescribeSecret"]
    resources = concat(values(nonsensitive(local.vcfo_secret_arns)), local.m7_secret_arns)
  }
  statement {
    sid       = "BackupPlanRead"
    actions   = ["backup:GetBackupPlan"]
    resources = [aws_backup_plan.db.arn]
  }
  statement {
    sid       = "BackupPointsRead"
    actions   = ["backup:ListRecoveryPointsByBackupVault"]
    resources = [aws_backup_vault.db.arn]
  }
  statement {
    sid       = "NatRead"
    actions   = ["ec2:DescribeInstances", "ec2:DescribeNatGateways"]
    resources = ["*"] # EC2 Describe* cannot be scoped to a resource
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.region]
    }
  }
  statement {
    sid     = "VpcConnectorRead"
    actions = ["apprunner:DescribeVpcConnector"]
    # The connector lives in the owner's private-network files; scope by its name prefix.
    resources = ["arn:aws:apprunner:${var.region}:${data.aws_caller_identity.current.account_id}:vpcconnector/${var.project}*"]
  }
  statement {
    sid     = "ServiceRead"
    actions = ["apprunner:DescribeService"]
    # Finds the connector ARN on the service. A pattern, not the resource, to avoid a cycle
    # (the service depends on this role).
    resources = ["arn:aws:apprunner:${var.region}:${data.aws_caller_identity.current.account_id}:service/${var.project}/*"]
  }
  statement {
    sid       = "RdsRead"
    actions   = ["rds:DescribeDBInstances"]
    resources = [aws_db_instance.postgres.arn]
  }
  dynamic "statement" {
    for_each = length(local.m7_secret_arns) > 0 ? [1] : []
    content {
      sid       = "M7RuntimeSecrets"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = local.m7_secret_arns
    }
  }
}

locals {
  m7_secret_arns = concat(
    aws_secretsmanager_secret.auth_secret_previous[*].arn,
    aws_secretsmanager_secret.credentials_encryption_key[*].arn,
  )
}

resource "aws_iam_role_policy" "app_console_soc_read" {
  name   = "${var.project}-app-console-soc-read"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app_console_soc_read.json
}

# AUTH_SECRET rotation without sign-outs (src/auth/secrets.ts). Terraform makes the empty
# secret only; the owner puts the old AUTH_SECRET value in it by hand, so the value never
# enters Terraform state. App Runner refuses to start when a referenced secret has no
# value, so put the value BEFORE turning auth_secret_previous_enabled on.
resource "aws_secretsmanager_secret" "auth_secret_previous" {
  count                   = var.auth_secret_previous_enabled ? 1 : 0
  name                    = "${var.project}/AUTH_SECRET_PREVIOUS"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_policy" "auth_secret_previous" {
  count      = var.auth_secret_previous_enabled ? 1 : 0
  secret_arn = aws_secretsmanager_secret.auth_secret_previous[0].arn
  policy     = data.aws_iam_policy_document.secret_lockdown.json
}

# Portal credentials and two-step secrets (src/lib/credentials-crypto.ts,
# src/lib/totp/secret-box.ts). Same pattern: Terraform makes the empty secret, the owner
# puts a 32-byte key (openssl rand -base64 32) in it by hand, then turns the flag on.
# Never rotate this key without re-encrypting first.
resource "aws_secretsmanager_secret" "credentials_encryption_key" {
  count                   = var.credentials_key_enabled ? 1 : 0
  name                    = "${var.project}/CREDENTIALS_ENCRYPTION_KEY"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_policy" "credentials_encryption_key" {
  count      = var.credentials_key_enabled ? 1 : 0
  secret_arn = aws_secretsmanager_secret.credentials_encryption_key[0].arn
  policy     = data.aws_iam_policy_document.secret_lockdown.json
}
