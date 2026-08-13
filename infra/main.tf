# VCFO Suite — AWS infrastructure (STAGE 2, not needed for the local pilot).
#
# Deliberately small: App Runner + RDS + S3 + KMS + Secrets + CloudFront.
# No EKS, no microservices. This is the right size for this product.
#
# Region ap-south-1 (Mumbai) = data residency for Indian client data.
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  # Remote state (uncomment once you create the bucket + lock table):
  # backend "s3" {
  #   bucket         = "vcfo-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "vcfo-terraform-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region
}
