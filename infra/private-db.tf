# Private database (SOC 2 findings #303, #85, #70), development-phase design.
#
# With var.db_private = true, RDS is no longer publicly accessible and port 5432
# accepts only the App Runner VPC connector and the NAT instance. App Runner then
# sends all outbound traffic through the VPC: two private subnets route to the
# internet through one small NAT instance (fck-nat on t4g.nano, about $7 a month)
# instead of a managed NAT gateway (about $41 a month). S3 traffic skips the NAT
# through a free gateway endpoint.
#
# After development, replace the NAT instance with an aws_nat_gateway and point
# the private route at it; nothing else here changes. That is the pattern the
# TP Doc Gen AI stack uses.
#
# The NAT instance doubles as the way in for people: with the SSM agent that
# fck-nat ships, `aws ssm start-session --document-name
# AWS-StartPortForwardingSessionToRemoteHost` opens a tunnel to RDS for
# db:migrate, so no laptop needs a public database port (README.md).
#
# If the instance stops, the app loses internet (email, Outlook, Ask VCFO) until
# the recovery alarm brings it back; the database itself keeps working.

locals {
  # Two unused /20 blocks in the default VPC (172.31.0.0/16; the three default
  # subnets hold 172.31.0.0/20, .16.0/20 and .32.0/20).
  private_subnets = {
    a = { az = "${var.region}a", cidr = "172.31.64.0/20" }
    b = { az = "${var.region}b", cidr = "172.31.80.0/20" }
  }
}

resource "aws_subnet" "private" {
  for_each                = var.db_private ? local.private_subnets : {}
  vpc_id                  = data.aws_vpc.default.id
  availability_zone       = each.value.az
  cidr_block              = each.value.cidr
  map_public_ip_on_launch = false
  tags                    = { Name = "${var.project}-private-${each.key}" }
}

# --- NAT instance ---------------------------------------------------------------
data "aws_ami" "fck_nat" {
  count       = var.db_private ? 1 : 0
  most_recent = true
  owners      = ["568608671756"] # the fck-nat project's AMI account
  filter {
    name   = "name"
    values = ["fck-nat-al2023-*-arm64-ebs"]
  }
}

# The NAT instance sits in the default public subnet of the first private AZ.
data "aws_subnet" "nat_public" {
  count             = var.db_private ? 1 : 0
  vpc_id            = data.aws_vpc.default.id
  availability_zone = local.private_subnets.a.az
  default_for_az    = true
}

resource "aws_security_group" "nat" {
  count       = var.db_private ? 1 : 0
  name        = "${var.project}-nat"
  description = "NAT instance for the ${var.project} private subnets"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "All traffic from the private subnets, to be forwarded"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [for s in local.private_subnets : s.cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 does not send aws:SourceAccount when it assumes an instance role, so this
# trust policy cannot carry the confused-deputy condition the App Runner roles
# have (the same accepted exception as the TP Doc Gen AI EC2 roles).
data "aws_iam_policy_document" "nat_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "nat" {
  count              = var.db_private ? 1 : 0
  name               = "${var.project}-nat"
  assume_role_policy = data.aws_iam_policy_document.nat_assume.json
}

resource "aws_iam_role_policy_attachment" "nat_ssm" {
  count      = var.db_private ? 1 : 0
  role       = aws_iam_role.nat[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "nat" {
  count = var.db_private ? 1 : 0
  name  = "${var.project}-nat"
  role  = aws_iam_role.nat[0].name
}

resource "aws_instance" "nat" {
  count                       = var.db_private ? 1 : 0
  ami                         = data.aws_ami.fck_nat[0].id
  instance_type               = "t4g.nano"
  subnet_id                   = data.aws_subnet.nat_public[0].id
  vpc_security_group_ids      = [aws_security_group.nat[0].id]
  associate_public_ip_address = true
  source_dest_check           = false # required to forward other hosts' traffic
  iam_instance_profile        = aws_iam_instance_profile.nat[0].name

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
  }

  tags = { Name = "${var.project}-nat" }

  lifecycle {
    ignore_changes = [ami] # a newer fck-nat AMI must not replace the running NAT
  }
}

# Restart the instance on the same host if AWS's system status check fails.
resource "aws_cloudwatch_metric_alarm" "nat_recover" {
  count               = var.db_private ? 1 : 0
  alarm_name          = "${var.project}-nat-recover"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  dimensions          = { InstanceId = aws_instance.nat[0].id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = ["arn:aws:automate:${var.region}:ec2:recover"]
}

# --- Routing ----------------------------------------------------------------------
resource "aws_route_table" "private" {
  count  = var.db_private ? 1 : 0
  vpc_id = data.aws_vpc.default.id

  route {
    cidr_block           = "0.0.0.0/0"
    network_interface_id = aws_instance.nat[0].primary_network_interface_id
  }

  tags = { Name = "${var.project}-private" }
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[0].id
}

# Free S3 gateway endpoint: document uploads and downloads skip the NAT.
resource "aws_vpc_endpoint" "s3" {
  count             = var.db_private ? 1 : 0
  vpc_id            = data.aws_vpc.default.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private[0].id]
}

# --- App Runner VPC connector -----------------------------------------------------
resource "aws_security_group" "connector" {
  count       = var.db_private ? 1 : 0
  name        = "${var.project}-connector"
  description = "App Runner VPC connector for ${var.project}"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_apprunner_vpc_connector" "app" {
  count              = var.db_private ? 1 : 0
  vpc_connector_name = var.project
  subnets            = [for s in aws_subnet.private : s.id]
  security_groups    = [aws_security_group.connector[0].id]
}
