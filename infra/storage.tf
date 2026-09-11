# S3 document vault — private, KMS-encrypted, versioned. Same API as MinIO.
resource "aws_kms_key" "docs" {
  description         = "${var.project} S3 encryption"
  enable_key_rotation = true
}

resource "aws_s3_bucket" "documents" {
  # Account id suffix keeps the name globally unique.
  bucket = "${var.project}-documents-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.docs.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true # one KMS call per bucket key, not per object
  }
}

# Versioning keeps every overwritten/deleted object forever unless bounded.
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    id     = "expire-noncurrent"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
