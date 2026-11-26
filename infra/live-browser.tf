# VCFO Live Browser (docs/specs/live-portal-browser/PLAN.md, DECISIONS.md B1 to B4) and the
# GSTZen settings the card agents need (GSTZEN.md). Everything here is behind a switch that is
# OFF by default, so `terraform plan` on the current state creates nothing:
#
#   live_browser_enabled = true   the broker on ECS Fargate behind an ALB on live.sbctrack.in
#   gstzen_enabled       = true   GSTZEN_* env and secrets on App Runner
#
# Shape (B3): ONE Fargate task (2 vCPU, 4 GB) runs the broker, which keeps a small pool of
# Chromium processes, one per session, each with a fresh temporary profile deleted at the end.
# The task sits in the private subnets of private-db.tf and reaches the portals through the NAT
# instance, which gets an Elastic IP here: that one fixed address is what MCA and GSTN see
# (proposed G23). Sessions live in the task's memory, so the service runs one task; a second
# node would need a session-to-node map in the ALB (not built). A deploy ends open sessions.
#
# Who reaches what:
#   - Viewers (staff browsers on Suite pages) open wss://live.sbctrack.in/sessions/<id>/stream
#     with a two-minute token Suite signed; the PDF routes also need an act token.
#   - Suite's control calls (/sessions, /sessions/<id>/status|stop, /warm) are HMAC-signed AND,
#     at the ALB, accepted only from the NAT's Elastic IP, which is App Runner's egress when
#     db_private is on. Anything else gets 403 from the ALB itself.
#   - The broker's callbacks go to https://<site_url>/api/live-browser/callback, signed.
#   - Only the ALB reaches the task (security group); the task's CDP port is never exposed.
#
# Order of the first apply (same as doubletick.tf): the secrets must hold a value before App
# Runner or ECS references them.
#   terraform apply -target=aws_secretsmanager_secret.live_browser_secret -target=aws_acm_certificate.live_browser
#   aws secretsmanager put-secret-value --secret-id vcfo-suite/LIVE_BROWSER_SHARED_SECRET --secret-string "$(openssl rand -hex 32)"
#   add the certificate's DNS record (output live_browser_certificate_dns), wait for ISSUED
#   docker build -f services/live-browser/Dockerfile -t <ecr>/vcfo-suite-live-browser:latest . && docker push …
#   terraform apply
#   add a CNAME live.sbctrack.in → output live_browser_alb_dns

variable "live_browser_enabled" {
  description = "Run the live browser broker on ECS Fargate (needs db_private = true for the private subnets and the NAT)."
  type        = bool
  default     = false
}

variable "live_browser_domain" {
  description = "The public name of the live browser stream."
  type        = string
  default     = "live.sbctrack.in"
}

variable "live_browser_image_tag" {
  description = "Image tag of vcfo-suite-live-browser in ECR."
  type        = string
  default     = "latest"
}

variable "live_browser_cpu" {
  description = "Fargate CPU units for the broker task (2048 = 2 vCPU)."
  type        = number
  default     = 2048
}

variable "live_browser_memory" {
  description = "Fargate memory (MiB) for the broker task; about 700 MB per open session plus 500 MB."
  type        = number
  default     = 4096
}

variable "live_browser_pool_max" {
  description = "Most live sessions open at once on the node."
  type        = number
  default     = 4
}

variable "live_browser_mock_portal" {
  description = "Serve the VCFO Assist mock portal inside the task (127.0.0.1:4318) for practice runs. Every pack is mock-only today."
  type        = bool
  default     = true
}

variable "gstzen_enabled" {
  description = "Inject GSTZEN_* into App Runner (the GSP API route of the card agents)."
  type        = bool
  default     = false
}

variable "gstzen_base_url" {
  description = "GSTZen API base URL."
  type        = string
  default     = "https://my.gstzen.in"
}

variable "gstzen_username" {
  description = "The firm's GSTZen login (not a GST portal login). Not secret."
  type        = string
  default     = ""
}

locals {
  lb_on = var.live_browser_enabled
  # App Runner reaches the broker over the public name, signed; the ALB also checks the source IP.
  live_browser_env = local.lb_on ? {
    LIVE_BROWSER_URL        = "https://${var.live_browser_domain}"
    LIVE_BROWSER_PUBLIC_URL = "wss://${var.live_browser_domain}"
  } : {}
  live_browser_secrets = local.lb_on ? { LIVE_BROWSER_SHARED_SECRET = aws_secretsmanager_secret.live_browser_secret[0].arn } : {}
  gstzen_env           = var.gstzen_enabled ? { GSTZEN_BASE_URL = var.gstzen_base_url, GSTZEN_USERNAME = var.gstzen_username } : {}
  gstzen_secrets = var.gstzen_enabled ? {
    GSTZEN_PASSWORD  = aws_secretsmanager_secret.gstzen_password[0].arn
    GSTZEN_API_TOKEN = aws_secretsmanager_secret.gstzen_api_token[0].arn
  } : {}
  live_browser_suite_url = var.site_url != "" ? var.site_url : "https://${var.app_domain}"
}

# --- Secrets (values put by hand, never in state) ------------------------------------------
resource "aws_secretsmanager_secret" "live_browser_secret" {
  count                   = local.lb_on ? 1 : 0
  name                    = "${var.project}/LIVE_BROWSER_SHARED_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "gstzen_password" {
  count                   = var.gstzen_enabled ? 1 : 0
  name                    = "${var.project}/GSTZEN_PASSWORD"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "gstzen_api_token" {
  count                   = var.gstzen_enabled ? 1 : 0
  name                    = "${var.project}/GSTZEN_API_TOKEN"
  recovery_window_in_days = 7
}

# The GSTZen secrets follow the firm lockdown (app role and admins only).
resource "aws_secretsmanager_secret_policy" "gstzen" {
  for_each   = var.gstzen_enabled ? { password = aws_secretsmanager_secret.gstzen_password[0].arn, token = aws_secretsmanager_secret.gstzen_api_token[0].arn } : {}
  secret_arn = each.value
  policy     = data.aws_iam_policy_document.secret_lockdown.json
}

# The shared secret is read by the app role and by the broker's task execution role.
data "aws_iam_policy_document" "live_browser_secret_lockdown" {
  count = local.lb_on ? 1 : 0
  statement {
    sid       = "DenyAllButVcfoAndBroker"
    effect    = "Deny"
    actions   = ["secretsmanager:*"]
    resources = ["*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "StringNotEquals"
      variable = "aws:PrincipalArn"
      values   = concat([aws_iam_role.app.arn, aws_iam_role.live_browser_execution[0].arn], var.secret_admin_arns)
    }
  }
}

resource "aws_secretsmanager_secret_policy" "live_browser_secret" {
  count      = local.lb_on ? 1 : 0
  secret_arn = aws_secretsmanager_secret.live_browser_secret[0].arn
  policy     = data.aws_iam_policy_document.live_browser_secret_lockdown[0].json
}

# App Runner reads the new secrets at start (runtime_environment_secrets in app.tf).
data "aws_iam_policy_document" "app_card_agent_secrets" {
  count = local.lb_on || var.gstzen_enabled ? 1 : 0
  statement {
    sid     = "CardAgentSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = concat(
      aws_secretsmanager_secret.live_browser_secret[*].arn,
      aws_secretsmanager_secret.gstzen_password[*].arn,
      aws_secretsmanager_secret.gstzen_api_token[*].arn,
    )
  }
}

resource "aws_iam_role_policy" "app_card_agent_secrets" {
  count  = local.lb_on || var.gstzen_enabled ? 1 : 0
  name   = "${var.project}-app-card-agent-secrets"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app_card_agent_secrets[0].json
}

# --- Fixed egress: an Elastic IP on the NAT instance (proposed G23) -------------------------
resource "aws_eip" "live_browser_egress" {
  count    = local.lb_on ? 1 : 0
  domain   = "vpc"
  instance = aws_instance.nat[0].id
  tags     = { Name = "${var.project}-egress" }

  lifecycle {
    precondition {
      condition     = var.db_private
      error_message = "live_browser_enabled needs db_private = true: the broker runs in the private subnets behind the NAT instance."
    }
  }
}

# --- Image -----------------------------------------------------------------------------------
resource "aws_ecr_repository" "live_browser" {
  count                = local.lb_on ? 1 : 0
  name                 = "${var.project}-live-browser"
  image_tag_mutability = "MUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "live_browser" {
  count      = local.lb_on ? 1 : 0
  repository = aws_ecr_repository.live_browser[0].name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}

# --- Roles -----------------------------------------------------------------------------------
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# Pulls the image, writes the logs and reads the shared secret at task start.
resource "aws_iam_role" "live_browser_execution" {
  count              = local.lb_on ? 1 : 0
  name               = "${var.project}-live-browser-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "live_browser_execution" {
  count      = local.lb_on ? 1 : 0
  role       = aws_iam_role.live_browser_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "live_browser_execution_secret" {
  count = local.lb_on ? 1 : 0
  name  = "${var.project}-live-browser-secret"
  role  = aws_iam_role.live_browser_execution[0].id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Sid = "SharedSecret", Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_secretsmanager_secret.live_browser_secret[0].arn] }]
  })
}

# The broker itself needs no AWS permission: it talks to Suite and the portals only.
resource "aws_iam_role" "live_browser_task" {
  count              = local.lb_on ? 1 : 0
  name               = "${var.project}-live-browser-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# --- Logs ------------------------------------------------------------------------------------
# The broker logs starts, ends and errors only: never a frame, a keystroke or a value.
resource "aws_cloudwatch_log_group" "live_browser" {
  count             = local.lb_on ? 1 : 0
  name              = "/ecs/${var.project}-live-browser"
  retention_in_days = 180 # CERT-In's 180 days
}

# --- Network ---------------------------------------------------------------------------------
resource "aws_security_group" "live_browser_alb" {
  count       = local.lb_on ? 1 : 0
  name        = "${var.project}-live-browser-alb"
  description = "Public HTTPS and WebSocket for the live browser stream"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP, redirected to HTTPS"
    from_port   = 80
    to_port     = 80
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

resource "aws_security_group" "live_browser_task" {
  count       = local.lb_on ? 1 : 0
  name        = "${var.project}-live-browser-task"
  description = "The live browser task: reachable from its ALB only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Broker port from the ALB"
    from_port       = 8091
    to_port         = 8091
    protocol        = "tcp"
    security_groups = [aws_security_group.live_browser_alb[0].id]
  }

  egress {
    description = "Portals and Suite through the NAT"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_acm_certificate" "live_browser" {
  count             = local.lb_on ? 1 : 0
  domain_name       = var.live_browser_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb" "live_browser" {
  count              = local.lb_on ? 1 : 0
  name               = "${var.project}-live"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.live_browser_alb[0].id]
  subnets            = data.aws_subnets.default.ids
  # A stream stays open while the person works; the ALB's idle limit must not cut it.
  idle_timeout               = 3600
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "live_browser" {
  count       = local.lb_on ? 1 : 0
  name        = "${var.project}-live"
  port        = 8091
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id
  # Let open streams finish their current frame on a deploy.
  deregistration_delay = 30

  health_check {
    path                = "/healthz"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "live_browser_http" {
  count             = local.lb_on ? 1 : 0
  load_balancer_arn = aws_lb.live_browser[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener: WebSockets upgrade over it as they are (ALB supports them natively).
resource "aws_lb_listener" "live_browser" {
  count             = local.lb_on ? 1 : 0
  load_balancer_arn = aws_lb.live_browser[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.live_browser[0].arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}

# Viewers: the stream, the PDF routes and the health check, from anywhere (each needs a token).
resource "aws_lb_listener_rule" "live_browser_viewers" {
  count        = local.lb_on ? 1 : 0
  listener_arn = aws_lb_listener.live_browser[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.live_browser[0].arn
  }

  condition {
    path_pattern {
      values = ["/sessions/*/stream", "/sessions/*/pdf", "/sessions/*/signed-pdf", "/healthz"]
    }
  }
}

# Suite's control calls: only from the NAT's Elastic IP (App Runner's egress with db_private).
resource "aws_lb_listener_rule" "live_browser_control" {
  count        = local.lb_on ? 1 : 0
  listener_arn = aws_lb_listener.live_browser[0].arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.live_browser[0].arn
  }

  condition {
    path_pattern {
      values = ["/sessions", "/sessions/*/status", "/sessions/*/stop", "/warm"]
    }
  }

  condition {
    source_ip {
      values = ["${aws_eip.live_browser_egress[0].public_ip}/32"]
    }
  }
}

# --- ECS -------------------------------------------------------------------------------------
resource "aws_ecs_cluster" "live_browser" {
  count = local.lb_on ? 1 : 0
  name  = "${var.project}-live-browser"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "live_browser" {
  count                    = local.lb_on ? 1 : 0
  family                   = "${var.project}-live-browser"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.live_browser_cpu
  memory                   = var.live_browser_memory
  execution_role_arn       = aws_iam_role.live_browser_execution[0].arn
  task_role_arn            = aws_iam_role.live_browser_task[0].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name         = "broker"
    image        = "${aws_ecr_repository.live_browser[0].repository_url}:${var.live_browser_image_tag}"
    essential    = true
    portMappings = [{ containerPort = 8091, protocol = "tcp" }]
    environment = concat(
      [
        { name = "PORT", value = "8091" },
        { name = "SUITE_URL", value = local.live_browser_suite_url },
        { name = "LIVE_BROWSER_POOL_MAX", value = tostring(var.live_browser_pool_max) },
        { name = "LIVE_BROWSER_WARM", value = "1" },
        { name = "LIVE_BROWSER_EGRESS_IP", value = aws_eip.live_browser_egress[0].public_ip },
        { name = "LIVE_BROWSER_NODE", value = "${var.project}-live-1" },
      ],
      var.live_browser_mock_portal ? [{ name = "LIVE_BROWSER_MOCK_PORT", value = "4318" }] : [],
    )
    secrets = [{ name = "LIVE_BROWSER_SHARED_SECRET", valueFrom = aws_secretsmanager_secret.live_browser_secret[0].arn }]
    # Chromium uses /dev/shm; Fargate gives a small one, so the broker passes --disable-dev-shm-usage.
    linuxParameters = { initProcessEnabled = true }
    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:8091/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.live_browser[0].name
        awslogs-region        = var.region
        awslogs-stream-prefix = "broker"
      }
    }
  }])
}

resource "aws_ecs_service" "live_browser" {
  count           = local.lb_on ? 1 : 0
  name            = "${var.project}-live-browser"
  cluster         = aws_ecs_cluster.live_browser[0].id
  task_definition = aws_ecs_task_definition.live_browser[0].arn
  launch_type     = "FARGATE"
  # Sessions live in the task's memory: one task (see the note at the top).
  desired_count                      = 1
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  enable_execute_command             = false

  network_configuration {
    subnets          = [for s in aws_subnet.private : s.id]
    security_groups  = [aws_security_group.live_browser_task[0].id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.live_browser[0].arn
    container_name   = "broker"
    container_port   = 8091
  }

  depends_on = [aws_lb_listener.live_browser, aws_secretsmanager_secret_policy.live_browser_secret]
}

# --- Outputs ---------------------------------------------------------------------------------
output "live_browser_certificate_dns" {
  description = "The DNS record that validates the live browser certificate."
  value       = local.lb_on ? aws_acm_certificate.live_browser[0].domain_validation_options : []
}

output "live_browser_alb_dns" {
  description = "Point a CNAME for live_browser_domain at this name."
  value       = local.lb_on ? aws_lb.live_browser[0].dns_name : ""
}

output "live_browser_egress_ip" {
  description = "The one IP the portals see (proposed G23)."
  value       = local.lb_on ? aws_eip.live_browser_egress[0].public_ip : ""
}

output "live_browser_ecr_url" {
  description = "Push the broker image here."
  value       = local.lb_on ? aws_ecr_repository.live_browser[0].repository_url : ""
}
