# VCFO Suite — AWS infrastructure (STAGE 2, not needed for the local pilot).
#
# Deliberately small: App Runner + RDS + S3 + KMS + Secrets Manager + SES.
# No EKS, no microservices, no NAT. This is the right size for this product.
#
# Region ap-south-1 (Mumbai) = data residency for Indian client data.
#
# Pilot network posture ("option B" in docs/context/AWS-DEPLOY.md): App Runner
# runs with public egress and RDS sits in the default VPC as publicly
# accessible, TLS forced, strong generated password. No VPC connector, so no
# NAT gateway (~$33/mo). Tighten to private subnets when the pilot outgrows it.
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # Remote state. Bucket created once by hand (see README.md); S3 native
  # locking (use_lockfile) means no DynamoDB table.
  backend "s3" {
    bucket       = "vcfo-suite-tfstate-600627321277"
    key          = "prod/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  # Every VCFO resource carries project=vcfo-suite so Cost Explorer, Budgets
  # and the Cost Category can isolate this product's spend on a shared account.
  # The tag key must be activated once in Billing > Cost allocation tags, and
  # activation is NOT retroactive — do it before anything here is applied.
  default_tags {
    tags = {
      project = var.project
    }
  }
}

data "aws_caller_identity" "current" {}
