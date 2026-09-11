output "app_url" {
  description = "Public HTTPS origin. Feed back as var.site_url on the second apply."
  value       = "https://${aws_apprunner_service.app.service_url}"
}
output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}
output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}
output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}
output "database_url_secret_arn" {
  description = "aws secretsmanager get-secret-value --secret-id <arn> for local db:migrate"
  value       = aws_secretsmanager_secret.database_url.arn
}
output "custom_domain_dns" {
  description = "Records to add at the DNS host for var.app_domain: the app CNAME plus ACM validation CNAMEs."
  value = var.app_domain == "" ? [] : concat(
    ["${var.app_domain} CNAME ${aws_apprunner_custom_domain_association.app[0].dns_target}"],
    [for r in aws_apprunner_custom_domain_association.app[0].certificate_validation_records : "${r.name} CNAME ${r.value}"],
  )
}
