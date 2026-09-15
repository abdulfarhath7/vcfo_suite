# RDS Postgres in Mumbai, KMS-encrypted. Same Postgres your app used locally.
resource "aws_kms_key" "db" {
  description         = "${var.project} RDS encryption"
  enable_key_rotation = true
}

# URL-safe on purpose: the password is embedded in DATABASE_URL unescaped.
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
  identifier                   = "${var.project}-db"
  engine                       = "postgres"
  engine_version               = "16"
  instance_class               = "db.t4g.micro" # scale up when you have paying customers
  allocated_storage            = 20
  storage_type                 = "gp3"
  storage_encrypted            = true
  kms_key_id                   = aws_kms_key.db.arn
  username                     = var.db_username
  password                     = random_password.db.result
  db_name                      = "vcfo"
  parameter_group_name         = aws_db_parameter_group.postgres.name
  db_subnet_group_name         = aws_db_subnet_group.postgres.name
  vpc_security_group_ids       = [aws_security_group.db.id]
  publicly_accessible          = true # option B; see main.tf header
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
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project}/DATABASE_URL"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${aws_db_instance.postgres.db_name}?sslmode=require"
}

# Auth.js session signing secret. Generated once; rotating it logs everyone out.
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
}

# Azure client secret for the Outlook Graph connect flow. Only created when the
# three azure_ad_* vars are set (see variables.tf). Rotating it in Azure means
# updating the var and re-applying; existing user connections keep working
# because refresh tokens are exchanged with the new secret.
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
}
