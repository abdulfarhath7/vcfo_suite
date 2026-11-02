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
  # Only the three default subnets; the private ones in private-db.tf stay out.
  filter {
    name   = "default-for-az"
    values = ["true"]
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

  # Public pilot: open to the internet with TLS forced. Private (db_private):
  # only the App Runner connector and the NAT instance (SSM tunnel) may connect.
  dynamic "ingress" {
    for_each = var.db_private ? [] : [1]
    content {
      description = "Postgres over TLS from App Runner + trusted laptops for migrate"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  dynamic "ingress" {
    for_each = var.db_private ? [1] : []
    content {
      description     = "Postgres from the App Runner VPC connector and the NAT instance"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = [aws_security_group.connector[0].id, aws_security_group.nat[0].id]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
