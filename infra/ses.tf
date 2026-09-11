# SES is the production email provider (EMAIL_PROVIDER=ses). The app role gets
# ses:SendEmail (app.tf). New accounts start in the SES sandbox: only verified
# recipients receive mail until production access is granted in the console.
resource "aws_sesv2_email_identity" "app" {
  count          = var.ses_identity == "" ? 0 : 1
  email_identity = var.ses_identity
}

# For a domain identity, publish these three CNAMEs at your DNS host.
output "ses_dkim_cnames" {
  value = var.ses_identity == "" ? [] : [
    for t in try(aws_sesv2_email_identity.app[0].dkim_signing_attributes[0].tokens, []) :
    "${t}._domainkey.${var.ses_identity} CNAME ${t}.dkim.amazonses.com"
  ]
}
