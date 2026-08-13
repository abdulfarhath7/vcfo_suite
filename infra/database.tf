# RDS Postgres in Mumbai, KMS-encrypted. Same Postgres your app used locally.
resource "aws_kms_key" "db" {
  description         = "${var.project} RDS encryption"
  enable_key_rotation = true
}

resource "aws_db_instance" "postgres" {
  identifier              = "${var.project}-db"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t4g.micro" # scale up when you have paying customers
  allocated_storage       = 20
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.db.arn
  username                = var.db_username
  password                = var.db_password
  db_name                 = "vcfo"
  skip_final_snapshot     = false
  backup_retention_period = 7
  multi_az                = false # set true for HA once in production
  # Keep private: attach to private subnets + SG in network.tf (TODO)
  publicly_accessible     = false
}
