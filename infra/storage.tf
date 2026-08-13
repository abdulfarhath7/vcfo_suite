# S3 document vault — private, KMS-encrypted, versioned. Same API as MinIO.
resource "aws_kms_key" "docs" {
  description         = "${var.project} S3 encryption"
  enable_key_rotation = true
}

resource "aws_s3_bucket" "documents" {
  bucket = "${var.project}-documents"
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
  }
}
