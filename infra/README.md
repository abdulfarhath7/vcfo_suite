# infra/ — AWS deployment (Stage 2)

Not needed for the local pilot. Terraform for one production environment in
`ap-south-1`: App Runner + RDS Postgres + S3/KMS + Secrets Manager + SES +
Budget + AWS Backup. **Since the SOC 2 remediation (October 2026) RDS is private**:
App Runner reaches it through a VPC connector, and a fck-nat NAT instance gives the VPC
outbound internet. The Terraform for that network (`private-db.tf` and others) is only on
the owner's laptop and not in git yet, so `network.tf` and the `main.tf` header here still
describe the old public pilot. See `docs/context/AWS-DEPLOY.md` §11.

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

# 5. Migrate from inside the VPC through the SSM tunnel on the NAT instance
#    (AWS-DEPLOY.md §11.3). RDS is private: never open it for this.
node scripts/db-env-prod.mjs   # prints the tunnel command and the DB_* exports
# run the tunnel in one terminal, paste the exports in another, then:
npm run db:migrate
```

## Every later deploy

Push a new `:latest` — `auto_deployments_enabled` redeploys App Runner:

```bash
docker build -t vcfo-suite:local . && docker tag vcfo-suite:local 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest && docker push 600627321277.dkr.ecr.ap-south-1.amazonaws.com/vcfo-suite:latest
```

Schema changes: run `npm run db:migrate` through the SSM tunnel (`node
scripts/db-env-prod.mjs` prints the steps) before, or right after, the push.
`drizzle.config.ts` reads the rotating RDS master secret through your AWS CLI login
at connect time; there is no production `DATABASE_URL` any more.

## Switching to the rotating DB password (done; kept for a fresh stack)

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
secret lands in Secrets Manager `vcfo-suite/AZURE_AD_CLIENT_SECRET` (first value
only), the ids and the secret's ARN (`AZURE_AD_CLIENT_SECRET_SECRET_ID`) in App
Runner env. Leave all three empty to deploy without the feature. M7: rotate every 6
months (SOC 2 exception 372) with `put-secret-value`; the app reads it at runtime,
so no apply and no redeploy (AWS-DEPLOY.md §11.1).

## Ask VCFO (in-app assistant)

Off until `ask_vcfo_enabled = true`. The Anthropic API key never goes through
Terraform: you create the secret by hand, Terraform only looks it up by name.

1. Secrets Manager (ap-south-1) → **Store a new secret** → *Other type of
   secret* → **Plaintext** tab → paste only the key (`sk-ant-…`, no quotes, no
   JSON) → name it `/vcfo/ask-vcfo/anthropic-api-key` → store.
2. Migrate RDS first (Ask VCFO tables are migrations `0021`–`0023`):
   `npm run db:migrate` through the SSM tunnel (AWS-DEPLOY.md §11.3).
3. In `terraform.tfvars` add `ask_vcfo_enabled = true`.
4. `terraform plan` — expect only the App Runner service (three env vars, one of
   them the secret's ARN as `ANTHROPIC_API_KEY_SECRET_ID`) and the app role
   policy (read the new secret) to change.
5. `terraform apply`. App Runner redeploys; "Ask VCFO" appears for client,
   admin and super admin.

Optional features (all off by default): add e.g.
`ask_vcfo_features = ["C1", "C4"]` to `terraform.tfvars`. Ids: C1 daily nudge,
C2 explain a document, C3 field help, C4 monthly status brief, C5 "what if I
miss it", A1 question gaps (shows clients a notice that the firm can see their
questions).

Rotate the key (every 90 days, SOC 2 exception 376): put a new value on the same
secret. M7: the app reads it at runtime (10-minute cache, re-read on a 401), so no
redeploy is needed. Turn off: `ask_vcfo_enabled = false`
and apply. Knowledge-source indexing runs in-process until Inngest cloud keys
are set.

## M7: console grants and rotation helpers (`soc-runtime.tf`)

- `aws_iam_role_policy.app_console_soc_read`: read-only grants for the developer
  console's SOC 2 cards (DescribeSecret on the vCFO secrets, the Backup plan and
  vault, EC2 Describe for the NAT, the VPC connector, the RDS instance).
- `auth_secret_previous_enabled`: makes `vcfo-suite/AUTH_SECRET_PREVIOUS` (value by
  hand) and injects it, for an AUTH_SECRET rotation without sign-outs.
- `credentials_key_enabled`: makes `vcfo-suite/CREDENTIALS_ENCRYPTION_KEY` (value by
  hand) and injects it. Put the value in before you turn the flag on: App Runner
  will not start with an empty secret.
- `ignore_changes` on the AUTH_SECRET and Azure secret versions, so an apply never
  puts back a value that was rotated by hand.

## Not here yet

- The private network files (VPC connector, NAT instance, private subnets) in git:
  they are on the owner's laptop only
- Inngest cloud keys (compliance digests), WhatsApp EUM number
