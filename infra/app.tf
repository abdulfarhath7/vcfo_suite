# App Runner runs the Next.js container from ECR. Autoscaling, no servers.
#
# Bootstrapping order (README.md): the service needs an image to exist, so the
# first apply targets the ECR repo, the image is pushed, then the full apply.

resource "aws_ecr_repository" "app" {
  name                 = var.project
  image_tag_mutability = "MUTABLE" # `latest` is re-pushed on every deploy
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# --- IAM: App Runner pulls the image with this role ---------------------------
data "aws_iam_policy_document" "apprunner_build_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
    # Confused-deputy guard: only App Runner acting for this account may assume it.
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "apprunner_access" {
  name               = "${var.project}-apprunner-access"
  assume_role_policy = data.aws_iam_policy_document.apprunner_build_assume.json
}

resource "aws_iam_role_policy_attachment" "apprunner_access_ecr" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# --- IAM: the running app assumes this role (S3 + KMS + SES + secrets) -------
# Least privilege: this bucket, this key, the vcfo secrets. The read-only grants
# for the developer console's SOC 2 cards are in soc-runtime.tf. No static keys —
# src/storage/s3.ts and send-via-ses.ts fall through to the instance role when
# S3_ACCESS_KEY_ID is unset.
data "aws_iam_policy_document" "apprunner_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
    # Confused-deputy guard: only App Runner acting for this account may assume it.
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.project}-app"
  assume_role_policy = data.aws_iam_policy_document.apprunner_tasks_assume.json
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "DocumentsBucketObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.documents.arn}/*"]
  }
  statement {
    sid       = "DocumentsBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.documents.arn]
  }
  statement {
    sid       = "DocumentsKms"
    actions   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey*", "kms:DescribeKey"]
    resources = [aws_kms_key.docs.arn]
  }
  statement {
    sid       = "SesSend"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
  }
  statement {
    sid     = "RuntimeSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = concat(
      [aws_secretsmanager_secret.auth_secret.arn],
      aws_secretsmanager_secret.database_url[*].arn,
      # The RDS-managed master secret, read by src/db/db-password.ts.
      local.db_rotating ? [local.db_master_secret_arn] : [],
      aws_secretsmanager_secret.azure_ad_client_secret[*].arn,
      data.aws_secretsmanager_secret.anthropic_api_key[*].arn,
    )
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "${var.project}-app"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

# --- App Runner ----------------------------------------------------------------
resource "aws_apprunner_auto_scaling_configuration_version" "app" {
  auto_scaling_configuration_name = var.project
  min_size                        = 1 # one warm instance: no cold start for the pilot
  max_size                        = 2
  max_concurrency                 = 100
}

locals {
  # Non-secret runtime config. Mirrors the AWS column of AWS-DEPLOY.md §4.
  # SITE_URL / AUTH_URL are only present once var.site_url is known (second apply).
  app_env = merge(
    {
      AUTH_TRUST_HOST           = "true"
      S3_REGION                 = var.region
      S3_BUCKET                 = aws_s3_bucket.documents.bucket
      S3_FORCE_PATH_STYLE       = "false"
      EMAIL_PROVIDER            = "ses"
      SES_REGION                = var.region
      EMAIL_FROM                = var.email_from
      NEXT_PUBLIC_MAX_UPLOAD_MB = "50"
      WHATSAPP_ENABLED          = "false"
    },
    var.site_url == "" ? {} : {
      SITE_URL             = var.site_url
      AUTH_URL             = var.site_url
      NEXT_PUBLIC_SITE_URL = var.site_url
    },
    # Rotating DB password (database.tf): the app builds its connection from
    # these and reads the password from DB_SECRET_ARN instead of DATABASE_URL.
    # The user name is not a secret; the variable is only marked sensitive.
    local.db_rotating ? {
      DB_HOST       = aws_db_instance.postgres.address
      DB_PORT       = tostring(aws_db_instance.postgres.port)
      DB_NAME       = aws_db_instance.postgres.db_name
      DB_USER       = nonsensitive(var.db_username)
      DB_SECRET_ARN = local.db_master_secret_arn
    } : {},
    # Outlook Graph connect flow. M7: the client secret is read at runtime from
    # Secrets Manager (src/lib/secrets/), so a rotation in Azure needs only a
    # put-secret-value, not a redeploy. The env var holds the ARN, not the value.
    local.outlook_enabled ? {
      AZURE_AD_CLIENT_ID               = var.azure_ad_client_id
      AZURE_AD_TENANT_ID               = var.azure_ad_tenant_id
      AZURE_AD_CLIENT_SECRET_SECRET_ID = aws_secretsmanager_secret.azure_ad_client_secret[0].arn
    } : {},
    # M7 developer console SOC 2 cards (soc-runtime.tf). Ids, not secrets.
    {
      BACKUP_PLAN_ID    = aws_backup_plan.db.id
      BACKUP_VAULT_NAME = aws_backup_vault.db.name
      RDS_INSTANCE_ID   = aws_db_instance.postgres.identifier
    },
    # Ask VCFO. M7: the API key is read at runtime from Secrets Manager (the env
    # var holds the ARN), so a rotation needs no redeploy. Model ids and limits
    # use the app defaults (.env.example); override here if needed.
    var.ask_vcfo_enabled ? merge(
      {
        ASK_VCFO_ENABLED            = "true"
        ASK_VCFO_LLM_PROVIDER       = "anthropic"
        ANTHROPIC_API_KEY_SECRET_ID = data.aws_secretsmanager_secret.anthropic_api_key[0].arn
      },
      { for id in var.ask_vcfo_features : "ASK_VCFO_FEATURE_${id}" => "true" },
    ) : {},
  )
}

resource "aws_apprunner_service" "app" {
  service_name = var.project

  source_configuration {
    auto_deployments_enabled = true # new push to :image_tag redeploys

    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    image_repository {
      image_repository_type = "ECR"
      image_identifier      = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"

      image_configuration {
        port                          = "3000"
        runtime_environment_variables = local.app_env
        runtime_environment_secrets = merge(
          { AUTH_SECRET = aws_secretsmanager_secret.auth_secret.arn },
          # Only while db_managed_password is off. Production runs with it on, so
          # the app reads DB_SECRET_ARN and DATABASE_URL is never injected.
          local.db_rotating ? {} : {
            DATABASE_URL = aws_secretsmanager_secret.database_url[0].arn
          },
          # M7: AZURE_AD_CLIENT_SECRET and ANTHROPIC_API_KEY are no longer injected
          # at deploy time; see the *_SECRET_ID env vars above.
          # AUTH_SECRET rotation without sign-outs (soc-runtime.tf).
          var.auth_secret_previous_enabled ? {
            AUTH_SECRET_PREVIOUS = aws_secretsmanager_secret.auth_secret_previous[0].arn
          } : {},
          var.credentials_key_enabled ? {
            CREDENTIALS_ENCRYPTION_KEY = aws_secretsmanager_secret.credentials_encryption_key[0].arn
          } : {},
        )
      }
    }
  }

  instance_configuration {
    cpu               = var.app_cpu
    memory            = var.app_memory
    instance_role_arn = aws_iam_role.app.arn
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.app.arn

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/robots.txt" # static, no DB round-trip
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  depends_on = [aws_iam_role_policy.app, aws_iam_role_policy.app_console_soc_read, aws_iam_role_policy_attachment.apprunner_access_ecr]
}

# Custom domain (e.g. app.sbctrack.in). Apply once to get the DNS records
# (output custom_domain_dns), add them at the registrar, wait for ACTIVE,
# then set site_url = "https://<app_domain>" and apply again.
resource "aws_apprunner_custom_domain_association" "app" {
  count                = var.app_domain == "" ? 0 : 1
  domain_name          = var.app_domain
  service_arn          = aws_apprunner_service.app.arn
  enable_www_subdomain = false
}
