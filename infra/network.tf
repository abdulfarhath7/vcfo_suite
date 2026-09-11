# Default VPC is enough for the pilot (docs/context/AWS-DEPLOY.md §3.1).
# RDS lives in its public subnets; App Runner has no VPC connector.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project}-db"
  subnet_ids = data.aws_subnets.default.ids
}

# App Runner egress IPs are not fixed, so 5432 cannot be pinned to the app.
# Compensating controls: rds.force_ssl=1 (database.tf) + 32-char random
# password + no public S3. Replace with a private subnet + VPC connector when
# the pilot graduates.
resource "aws_security_group" "db" {
  name        = "${var.project}-db"
  description = "Postgres for ${var.project} (pilot: public with TLS forced)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Postgres over TLS from App Runner + trusted laptops for migrate"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
