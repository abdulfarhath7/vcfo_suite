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
# pg treats sslmode=require as verify-full, so trust the RDS CA bundle; without
# it drizzle-kit exits 1 with no message.
export NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem
npm run db:migrate && npm run db:seed
```

## Every later deploy

Push a new `:latest` — `auto_deployments_enabled` redeploys App Runner:

```bash
docker build -t vcfo-suite:local . && docker tag vcfo-suite:local 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest && docker push 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest
```

Schema changes: run `NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem npm run db:migrate`
with the RDS `DATABASE_URL` before (or right after) the push. Once
`db_managed_password` is on, get that URL with
`export DATABASE_URL="$(node scripts/db-url-prod.mjs)"`, which reads the
rotating RDS master secret through your AWS CLI login.

## Switching to the rotating DB password

SOC 2 finding #370: the `vcfo-suite/DATABASE_URL` secret never rotates. With
`db_managed_password = true` RDS owns the master password, keeps it in its own
secret and rotates it every 7 days; the app reads it per new connection
(`src/db/client.ts`, `DB_SECRET_ARN`). Do it in this order:

1. Deploy an image that contains the new `src/db/client.ts` while the flag is
   still false. With `DATABASE_URL` set the app behaves exactly as before.
2. At night, set `db_managed_password = true` in tfvars and apply **twice, back
   to back**. The first apply switches RDS to the managed password (the old
   password stops working); the second sees the new secret's ARN and moves App
   Runner to `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_SECRET_ARN`. Expect
   2 to 5 minutes of failed new DB connections while App Runner redeploys. If
   the second plan shows no App Runner change, RDS has not finished: check
   `aws rds describe-db-instances` for `MasterUserSecret` and plan again.
3. Log in to the app. Then run
   `aws secretsmanager rotate-secret --secret-id <MasterUserSecret ARN>` (or
   `aws rds modify-db-instance --db-instance-identifier vcfo-suite-db
   --rotate-master-user-password --apply-immediately`), wait a minute, and
   confirm the app still logs in and loads pages. Then check that
   `MasterUserSecret.SecretStatus` in `describe-db-instances` is `active`, not
   `impaired`: `impaired` means the deny-all secret policy blocks RDS's own
   rotation, and the policy needs an exception for AWS services.
4. The second apply deletes the old `DATABASE_URL` secret with a 7-day recovery
   window. Turning the flag off inside that window fails on the secret name;
   restore the secret (`aws secretsmanager restore-secret`) and import it first.

## Private database (db_private)

`db_private = true` makes RDS private (SOC 2 #303, #85, #70): App Runner reaches it
through a VPC connector, and the private subnets reach the internet through one
small NAT instance (`private-db.tf`, about $7 a month). After development, swap
the NAT instance for a NAT gateway; the rest stays.

Cut-over (about 5-10 minutes of errors while App Runner moves to the connector):

1. Take an RDS snapshot.
2. `terraform apply -var db_private=true`, then set the variable's default to true
   so later applies keep it.
3. Log in, send one email, open Ask VCFO and an Outlook connection.

Rollback: apply with `db_private = false`; RDS becomes public again and App
Runner returns to default egress.

Database access from a laptop (db:migrate) goes through an SSM tunnel on the NAT
instance. Install the AWS Session Manager plugin once, then:

```bash
NAT=$(aws ec2 describe-instances --filters Name=tag:Name,Values=vcfo-suite-nat \
  Name=instance-state-name,Values=running --query 'Reservations[0].Instances[0].InstanceId' --output text)
aws ssm start-session --target "$NAT" --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters host=vcfo-suite-db.ctiq24mcyaje.ap-south-1.rds.amazonaws.com,portNumber=5432,localPortNumber=15432
```

Keep that running. TLS is verified against the RDS host name, so do not use
`localhost`: add `127.0.0.1 vcfo-suite-db.ctiq24mcyaje.ap-south-1.rds.amazonaws.com`
to `/etc/hosts` while you work, and use the URL from `node scripts/db-url-prod.mjs`
with the port changed to 15432. Remove the hosts line afterwards.

The NAT instance patches through `dnf` on Amazon Linux 2023. Run
`sudo dnf upgrade -y && sudo reboot` through `aws ssm start-session --target "$NAT"`
once a month (the reboot cuts app internet for about a minute).

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

## Ask VCFO (in-app assistant)

Off until `ask_vcfo_enabled = true`. The Anthropic API key never goes through
Terraform: you create the secret by hand, Terraform only looks it up by name.

1. Secrets Manager (ap-south-1) → **Store a new secret** → *Other type of
   secret* → **Plaintext** tab → paste only the key (`sk-ant-…`, no quotes, no
   JSON) → name it `/vcfo/ask-vcfo/anthropic-api-key` → store.
2. Migrate RDS first (Ask VCFO tables are migrations `0021`–`0023`):
   `DATABASE_URL=<rds url> NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem npm run db:migrate`.
3. In `terraform.tfvars` add `ask_vcfo_enabled = true`.
4. `terraform plan` — expect only the App Runner service (two env vars, one
   secret) and the app role policy (read the new secret) to change.
5. `terraform apply`. App Runner redeploys; "Ask VCFO" appears for client,
   admin and super admin.

Optional features (all off by default): add e.g.
`ask_vcfo_features = ["C1", "C4"]` to `terraform.tfvars`. Ids: C1 daily nudge,
C2 explain a document, C3 field help, C4 monthly status brief, C5 "what if I
miss it", A1 question gaps (shows clients a notice that the firm can see their
questions).

Rotate the key: put a new value on the same secret, then redeploy the service
(App Runner reads secrets at deploy time). Turn off: `ask_vcfo_enabled = false`
and apply. Knowledge-source indexing runs in-process until Inngest cloud keys
are set.

## Not here yet

- Private RDS + VPC connector + NAT (when the pilot outgrows option B)
- Inngest cloud keys (compliance digests), WhatsApp EUM number
