# infra/ — AWS deployment (Stage 2)

Not needed for the local pilot. Terraform for one production environment in
`ap-south-1`: App Runner + RDS Postgres + S3/KMS + Secrets Manager + SES +
Budget. Pilot network posture is **public RDS with TLS forced, no VPC
connector, no NAT** (see `main.tf` header and `docs/context/AWS-DEPLOY.md`).

## One-time prerequisites

- Terraform >= 1.10 (`~/.local/bin/terraform` on the build laptop)
- AWS CLI signed in: `aws login --profile vcfo`. Terraform's SDK does not read
  the CLI's login session, so export it first for every terraform command:
  ```bash
  eval "$(aws configure export-credentials --profile vcfo --format env)"
  ```
- Remote state bucket `vcfo-suite-tfstate-600627321277` (versioned, private;
  created by hand once). S3 native locking, no DynamoDB.
- `terraform.tfvars` (gitignored): `alert_emails`, `email_from`, `ses_identity`.
- Activate the `project` cost allocation tag once in Billing > Cost allocation
  tags after the first apply (the key must exist on a resource first). The
  budget filter reads $0 until then.

## First deploy

```bash
cd infra && terraform init
# 1. Everything except the App Runner service (it needs an image to exist).
TARGETS=$(grep -hoE '^resource "[a-z0-9_]+" "[a-z0-9_]+"' *.tf \
  | grep -v apprunner_service \
  | sed -E 's/resource "([^"]+)" "([^"]+)"/-target=\1.\2/' | tr '\n' ' ')
terraform plan $TARGETS -out=tfplan-1 && terraform apply tfplan-1

# 2. Build + push the image (repo root).
aws ecr get-login-password --profile vcfo | docker login --username AWS --password-stdin 600627321277.dkr.ecr.ap-south-1.amazonaws.com
docker build -t vcfo-suite:local .
docker tag vcfo-suite:local 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest
docker push 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest

# 3. Full apply — App Runner comes up and prints app_url.
terraform apply

# 4. Feed the URL back so AUTH_URL / SITE_URL are set, then re-apply.
echo 'site_url = "https://xxxx.ap-south-1.awsapprunner.com"' >> terraform.tfvars
terraform apply

# 5. Migrate + seed from this laptop (RDS is reachable; TLS required).
export DATABASE_URL="$(aws secretsmanager get-secret-value --profile vcfo \
  --secret-id vcfo-suite/DATABASE_URL --query SecretString --output text)"
npm run db:migrate && npm run db:seed
```

## Every later deploy

Push a new `:latest` — `auto_deployments_enabled` redeploys App Runner:

```bash
docker build -t vcfo-suite:local . && docker tag vcfo-suite:local 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest && docker push 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest
```

Schema changes: run `npm run db:migrate` with the RDS `DATABASE_URL` before
(or right after) the push.

## Email (SES)

`EMAIL_PROVIDER=ses`, From = `var.email_from`. The domain identity's three
DKIM CNAMEs are in `terraform output ses_dkim_cnames` — publish them at the DNS
host. The account starts in the SES **sandbox** (verified recipients only,
200/day): request production access in the SES console before inviting real
clients.

## Custom domain

`var.app_domain` (tfvars) creates the App Runner custom-domain association;
output `custom_domain_dns` lists the CNAMEs to add at the registrar (app host
+ ACM validation). Once the association is ACTIVE, set
`site_url = "https://<app_domain>"` and apply again. GoDaddy has no ALIAS
record, so the apex cannot point at App Runner — use a subdomain
(`app.sbctrack.in`, live 2026-09-11).

## Outlook connect (Microsoft Graph)

Azure app registration "VCFO Suite Outlook" needs redirect
`https://app.sbctrack.in/api/outlook/callback` and delegated `Mail.Send`,
`User.Read`, `offline_access`. Set `azure_ad_client_id`, `azure_ad_tenant_id`,
`azure_ad_client_secret` in `terraform.tfvars` (gitignored) and apply — the
secret lands in Secrets Manager `vcfo-suite/AZURE_AD_CLIENT_SECRET`, the ids in
App Runner env. Leave all three empty to deploy without the feature. When the
Azure secret expires (max 24 months), paste the new value and re-apply.

## Not here yet

- Private RDS + VPC connector + NAT (when the pilot outgrows option B)
- Inngest cloud keys (compliance digests), WhatsApp EUM number
