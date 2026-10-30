# AWS Backup plan for the RDS instance (SOC 2 finding: RDS not protected by a
# backup plan). This sits on top of the 7-day automated backups in database.tf
# and keeps one daily snapshot for 30 days in a vault encrypted with the DB key.
resource "aws_backup_vault" "db" {
  name        = "${var.project}-db"
  kms_key_arn = aws_kms_key.db.arn
}

resource "aws_backup_plan" "db" {
  name = "${var.project}-db"

  rule {
    rule_name         = "daily-30d"
    target_vault_name = aws_backup_vault.db.name
    schedule          = "cron(30 20 * * ? *)" # 02:00 IST, after the working day
    lifecycle {
      delete_after = 30
    }
  }
}

# Own service role with a confused-deputy guard, so it does not raise the same
# finding as the App Runner roles did.
data "aws_iam_policy_document" "backup_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${var.project}-backup"
  assume_role_policy = data.aws_iam_policy_document.backup_assume.json
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "backup_restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_selection" "db" {
  name         = "${var.project}-db"
  plan_id      = aws_backup_plan.db.id
  iam_role_arn = aws_iam_role.backup.arn
  resources    = [aws_db_instance.postgres.arn]
}
