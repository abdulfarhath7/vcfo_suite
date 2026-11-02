# AWS deploy checklist (Stage 2)

**Goal:** run VCFO Suite on AWS with the same code as local — only env vars change.  
**Region:** `ap-south-1` (Mumbai).  
**Email for v1:** keep **Resend** (`EMAIL_PROVIDER=resend`). SES is ready behind
`EMAIL_PROVIDER=ses` — flip only after identity + (usually) production access.

This is a **paid-plan pilot**, not “forever free.” Set a billing alarm on day one.

This file is the engineering deploy checklist. (The Finance architecture pack, `docs/architecture/vcfo-aws-architecture.html`, was removed on 2026-09-30; it is in git history.)

---

## 0. Preconditions (do these before AWS)

- [ ] Local pilot works: login as admin / manager / lead / client
- [ ] `npm run typecheck && npm run test` green
- [ ] You own a domain (or will use the App Runner / Lightsail URL temporarily)
- [ ] Resend domain verified (or accept `@resend.dev` → owner-only delivery for smoke tests)
- [ ] AWS account on **Paid plan** + MFA on root + IAM admin user (never use root day-to-day)

**Budget guardrails**

- [ ] Billing → Budgets: alert at **$10** and **$25**
- [ ] Prefer `db.t4g.micro`, single-AZ, no Multi-AZ until you have paying load
- [ ] Do **not** enable unused services (OpenSearch, ElastiCache, NAT gateways ×3, etc.)

---

## 1. What already exists in this repo

| Piece | Status |
|---|---|
| `infra/*.tf` | One environment: RDS, S3 + KMS, Secrets Manager (deny-all resource policy on every secret), ECR, IAM, App Runner, SES identity, Budget, AWS Backup plan, and the M7 read-only console grants (`soc-runtime.tf`). Runbook in `infra/README.md`. **Note (M7):** the private network files (`private-db.tf` and others: private subnets, VPC connector, fck-nat NAT instance) exist only on the owner's laptop and are not in git yet; `network.tf` and the RDS comments in git still describe the old public pilot. The live account is private (§11). |
| `Dockerfile` | Multi-stage, `output: 'standalone'`, RDS CA bundle baked in |
| App ↔ DB / S3 / Auth | Ready via env (see §4) |

Deployed 2026-09-11 (option B network posture). Since the SOC 2 remediation (October 2026) RDS is private, see §11. Every later deploy = push `:latest` to ECR.

---

## 2. Recommended architecture (smallest that fits this app)

```
Internet
   │
   ▼
App Runner  ← Next.js (`npm run build` + `next start`)
   │  VPC connector (private subnets)
   ├── RDS Postgres 16 — private (PubliclyAccessible=false), TLS forced,
   │                     password = RDS-managed secret, rotated every 7 days
   ├── NAT instance (fck-nat t4g.nano, role vcfo-suite-nat) — outbound internet for the
   │                     VPC (Secrets Manager, Anthropic, Microsoft, Resend)
   ├── S3 private bucket (documents)
   └── Resend / SES (external HTTPS)
```

**Backup if App Runner is unavailable for new accounts:** Lightsail container or a single small EC2 + Docker. Same image, same env.

**Do not use for v1:** EKS, Lambda-per-route, Cognito (Auth.js already handles auth), CloudFront (optional later).

---

## 3. Provision order (manual or Terraform)

### 3.1 Networking (minimum for pilot)

- [x] Private subnets + no public RDS + App Runner VPC connector + NAT instance (SOC 2, October 2026; files on the owner's laptop, see §1)
- [ ] Never add `0.0.0.0/0` on 5432 and never set `publicly_accessible = true`, not even for a migration (§11.3)

### 3.2 RDS Postgres

- [ ] Engine: PostgreSQL **16**
- [ ] Class: **`db.t4g.micro`**
- [ ] Storage: 20 GB gp3, encrypted
- [ ] DB name: `vcfo`
- [ ] Master user: `vcfo` (password in Secrets Manager / strong random)
- [ ] Backup retention ≥ 7 days
- [ ] Security group: inbound **5432** only from the VPC connector and the NAT instance
- [x] Master password managed by RDS (`manage_master_user_password`), rotated every 7 days

There is no connection string in production. The app gets `DB_SECRET_ARN`, `DB_HOST`,
`DB_PORT`, `DB_NAME` and `DB_USER` and reads the password per new connection
(`src/db/client.ts`, `src/db/db-password.ts`). `DATABASE_URL` is for local dev only.

### 3.3 S3 documents bucket

- [ ] Bucket name: e.g. `vcfo-suite-documents` (globally unique)
- [ ] Block **all** public access
- [ ] Versioning on
- [ ] Default encryption (SSE-S3 is fine for pilot; KMS if matching `infra/storage.tf`)
- [ ] IAM policy: app role/user can `s3:GetObject|PutObject|DeleteObject` on `arn:aws:s3:::BUCKET/*` plus `ListBucket` on the bucket

### 3.4 Container registry + app host

- [ ] Create **ECR** repo `vcfo-suite`
- [ ] Add a `Dockerfile` at repo root (Node 22 / 24 LTS, `npm ci`, `npm run build`, `CMD ["npm","run","start"]` listening on `PORT`)
- [ ] Build → push to ECR
- [ ] Create **App Runner** service from that image (or Lightsail)
- [ ] Attach instance role with S3 (+ Secrets read) — prefer role over long-lived access keys
- [x] Map custom domain — `app.sbctrack.in` via `var.app_domain` (GoDaddy CNAME; apex not possible without ALIAS)

### 3.5 Secrets

Store in **Secrets Manager** or App Runner encrypted env (not in git / not in image):

- The RDS-managed master secret (`DB_SECRET_ARN`, rotated by RDS every 7 days)
- `vcfo-suite/AUTH_SECRET` (and `vcfo-suite/AUTH_SECRET_PREVIOUS` during a rotation)
- `vcfo-suite/CREDENTIALS_ENCRYPTION_KEY`
- `vcfo-suite/AZURE_AD_CLIENT_SECRET`, `/vcfo/ask-vcfo/anthropic-api-key` (read at runtime, §11.2)
- `RESEND_API_KEY`
- S3 keys **only if** not using instance role

The old `vcfo-suite/DATABASE_URL` secret is deleted. Every vCFO secret has a deny-all
resource policy; only the app role, the admins, the SOC scanner and the RDS role are exempt.

---

## 4. Env var map (local → AWS)

Copy from `.env.example`. Production values:

| Variable | Local | AWS |
|---|---|---|
| `DATABASE_URL` | docker Postgres | **not set** (local dev only) |
| `DB_SECRET_ARN` / `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` | unset | set by Terraform; the password is read from the RDS-managed secret per connection. The process trusts `certs/rds-global-bundle.pem` via `NODE_EXTRA_CA_CERTS` (the Dockerfile does) |
| `DB_SSL_SERVERNAME` | unset | unset on App Runner; the RDS endpoint for a laptop script through the SSM tunnel (§11.3) |
| `AUTH_SECRET` | random | Secrets Manager `vcfo-suite/AUTH_SECRET` (rotate every 90 days, §11.1) |
| `AUTH_SECRET_PREVIOUS` | unset | only during a rotation: `vcfo-suite/AUTH_SECRET_PREVIOUS` (`auth_secret_previous_enabled`) |
| `CREDENTIALS_ENCRYPTION_KEY` | optional | Secrets Manager `vcfo-suite/CREDENTIALS_ENCRYPTION_KEY` (`credentials_key_enabled`) |
| `AUTH_URL` | `http://localhost:3000` | `https://app.yourdomain.com` |
| `AUTH_TRUST_HOST` | `true` | `true` |
| `NEXT_PUBLIC_SITE_URL` | localhost | same public HTTPS URL as `AUTH_URL` |
| `S3_ENDPOINT` | MinIO URL | **unset / delete** |
| `S3_REGION` | `us-east-1` | `ap-south-1` |
| `S3_BUCKET` | `vcfo-documents` | your AWS bucket name |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | MinIO | omit if IAM role; else IAM user keys |
| `S3_FORCE_PATH_STYLE` | `true` | **`false` or unset** |
| `RESEND_API_KEY` | empty = console | production key |
| `RESEND_FROM_EMAIL` | resend.dev OK for tests | `Name <info@sbctrack.in>` |
| `RESEND_DEV_REDIRECT_TO` | optional locally | **must be unset** |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_TENANT_ID` | Azure app values | same (tfvars `azure_ad_*` → App Runner env) |
| `AZURE_AD_CLIENT_SECRET` | Azure secret value | **not set**; `AZURE_AD_CLIENT_SECRET_SECRET_ID` = the ARN of `vcfo-suite/AZURE_AD_CLIENT_SECRET`, read at runtime |
| `ANTHROPIC_API_KEY` | API key | **not set**; `ANTHROPIC_API_KEY_SECRET_ID` = the ARN of `/vcfo/ask-vcfo/anthropic-api-key`, read at runtime |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Entra secret value | **not set**; `AUTH_MICROSOFT_ENTRA_ID_SECRET_ID` (name or ARN) when Microsoft sign-in is on |
| `BACKUP_PLAN_ID` / `BACKUP_VAULT_NAME` / `RDS_INSTANCE_ID` | unset | set by Terraform for the console's SOC 2 cards |
| `APP_RUNNER_VPC_CONNECTOR_ARN` / `NAT_INSTANCE_ID` | unset | optional; the console finds both on its own |
| `NEXT_PUBLIC_ENABLE_DEMO_AUTH` | off | **must be unset / not `true`** |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `50` | same unless you raise intentionally |

Code already expects this swap:

- DB: `src/db/client.ts`
- S3: `src/storage/s3.ts` (`endpoint` undefined → real AWS)
- Email links: `NEXT_PUBLIC_SITE_URL` / `siteUrl()`

---

## 5. First deploy runbook

1. [ ] Provision RDS + S3 + App Runner/Lightsail
2. [ ] Set production env on the service (§4)
3. [ ] Migrate from inside the VPC through the SSM tunnel (§11.3), never by opening RDS:
   ```bash
   node scripts/db-env-prod.mjs      # prints the tunnel command and the DB_* exports
   # terminal 1: run the printed `aws ssm start-session ...` command
   # terminal 2: paste the exports, then
   npm run db:migrate
   # compliance calendar stays empty until the generator runs; Inngest cron is
   # not wired on App Runner yet, so run it by hand after creating engagements:
   npm run compliance:generate
   ```
4. [ ] Open `AUTH_URL` → login as seeded admin
5. [ ] Smoke test:
   - [ ] Create project (auto-creates client)
   - [ ] Client KYC submit
   - [ ] Manager/admin Accept/Reject
   - [ ] Upload a document (hits S3)
   - [ ] Trigger one progress email (Resend dashboard shows delivery)
6. [x] RDS is private; nothing to turn off

---

## 6. Terraform path (when you prefer IaC)

Current stubs live under `infra/`. Suggested finish order:

1. [x] Private network (VPC connector, NAT instance, private RDS) — on the owner's laptop; commit it to git
2. [x] `database.tf` on the private subnets (same)
3. [ ] Keep `storage.tf` (already useful)
4. [ ] Flesh out `app.tf` — ECR + App Runner + IAM role + secret ARNs
5. [ ] Uncomment S3 backend in `main.tf` for remote state
6. [ ] `terraform apply` with `-var='db_password=...'` (never commit tfvars with secrets)

Until then, console provisioning is acceptable for one pilot environment.

---

## 7. Domain + HTTPS

- [x] App Runner custom domain `app.sbctrack.in` (Terraform `aws_apprunner_custom_domain_association`, ACM cert auto-issued)
- [ ] `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` must match the browser URL exactly (scheme + host)
- [ ] After domain change, re-login (cookies / Auth.js)

---

## 8. Explicitly deferred / optional flips

| Item | When |
|---|---|
| **SES** instead of Resend | After first stable AWS week. Code is ready: set `EMAIL_PROVIDER=ses`, `EMAIL_FROM`/`SES_FROM_EMAIL`, verify domain in SES (`SES_REGION=ap-south-1`), IAM `ses:SendEmail` on the app role, request SES production access out of sandbox. Keep Resend keys until SES delivers. |
| Inngest / compliance digests on AWS | After core portal works |
| Multi-AZ RDS / bigger instance | Paying customers / HA need |
| CloudFront | Global CDN need |
| Cognito | Only if you drop Auth.js (not planned) |

---

## 9. Cost sanity (quiet 10-user pilot)

Rough ballpark if you stay small: **~$15–40 / month** (micro RDS + small container + S3 + light egress). Credits may cover the first weeks; they will not cover forever. That figure is **before WhatsApp (AWS End User Messaging)**.

---

## 10. Go / no-go

**Go to AWS when:** local/LAN pilot is boringly reliable and you need offsite access.

**Stay local when:** still changing KYC/assignment flows daily — deploy churn will slow you down more than hosting helps.

---

## 11. SOC 2 posture, rotation and migrations (M7, 2026-10-30)

Prowler scan, account 600627321277, ap-south-1. What is in place:

| Control | State |
|---|---|
| RDS | Private (`PubliclyAccessible=false`). App Runner reaches it through a VPC connector. Outbound internet goes through the fck-nat NAT instance (t4g.nano, role `vcfo-suite-nat`). |
| DB password | The RDS-managed master secret, rotated every 7 days. The app reads it per new connection and drops the cached value on a login failure (`28P01`). `vcfo-suite/DATABASE_URL` is deleted. |
| Secrets | Every secret has a deny-all resource policy. Exempt: the app role, the admins, the scanner and the RDS role. |
| App Runner roles | The trust policies require `aws:SourceAccount`. |
| Backups | AWS Backup plan `vcfo-suite-db`: daily at 02:00 IST, kept 30 days, in a KMS vault. RDS automated backups stay at 7 days. |
| Console | Access › Secrets and rotation; Data and costs › Backups (AWS Backup part) and Network. Read-only grants in `infra/soc-runtime.tf`. A card says "Not connected" when the role cannot read the control. |

### 11.1 Accepted exceptions with manual rotation

| Finding | Secret | Every | Next review | How to rotate (no redeploy unless stated) |
|---|---|---|---|---|
| 371 | `vcfo-suite/AUTH_SECRET` | 90 days | 31 Jan 2027 | See the steps below. Nobody is signed out. |
| 372 | `vcfo-suite/AZURE_AD_CLIENT_SECRET` | 6 months | 30 Apr 2027 | Make a new client secret in Entra, then `aws secretsmanager put-secret-value --secret-id vcfo-suite/AZURE_AD_CLIENT_SECRET --secret-string <value>`. The app uses it within 10 minutes, or at once on the first `invalid_client`. Delete the old secret in Entra after a day. |
| 376 | `/vcfo/ask-vcfo/anthropic-api-key` | 90 days | 31 Jan 2027 | Make a new key in the Anthropic console, `put-secret-value`, then revoke the old key. The app reads the new key within 10 minutes, or at once on the first 401. |

AUTH_SECRET rotation (finding 371):

1. Put the current AUTH_SECRET value into `vcfo-suite/AUTH_SECRET_PREVIOUS` (`put-secret-value`).
2. Set `auth_secret_previous_enabled = true` and `terraform apply` (App Runner now injects both).
3. Put a new random value (`openssl rand -base64 32`) into `vcfo-suite/AUTH_SECRET` and redeploy
   (App Runner reads runtime secrets at deploy time). New tokens use the new secret; old
   tokens still verify and are re-issued with the new one on the next request.
4. After 30 days (the longest session), set the flag back to false and apply.

Two-step (TOTP) secrets no longer depend on AUTH_SECRET: they are sealed with
CREDENTIALS_ENCRYPTION_KEY. Run `npm run totp:reencrypt` once (§11.3) after that key is set,
and before the first AUTH_SECRET rotation. Outlook tokens and connect states still use
AUTH_SECRET, but they open with AUTH_SECRET_PREVIOUS too and are re-sealed at the next refresh.

### 11.2 Runtime secrets

`ANTHROPIC_API_KEY_SECRET_ID`, `AZURE_AD_CLIENT_SECRET_SECRET_ID` and
`AUTH_MICROSOFT_ENTRA_ID_SECRET_ID` name a secret (ARN or name). When one is set, the app
reads that secret from Secrets Manager (`src/lib/secrets/`), keeps it in memory for about
10 minutes, and reads it again at once when the provider answers 401 or `invalid_client`.
Locally, the plain env vars (`ANTHROPIC_API_KEY`, `AZURE_AD_CLIENT_SECRET`,
`AUTH_MICROSOFT_ENTRA_ID_SECRET`) still work.

### 11.3 Migrations and one-off scripts: from inside the VPC only

RDS has no public endpoint. Never set `publicly_accessible = true` or open 5432 to
`0.0.0.0/0` for a migration. Use the SSM port forward through the NAT instance:

```bash
node scripts/db-env-prod.mjs     # your AWS profile; prints the two blocks below, no password
# Terminal 1 (Session Manager plugin installed):
aws ssm start-session --region ap-south-1 --target <nat-instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["<rds-endpoint>"],"portNumber":["5432"],"localPortNumber":["15432"]}'
# Terminal 2: the printed exports (DB_SECRET_ARN, DB_HOST=127.0.0.1, DB_PORT=15432,
# DB_NAME, DB_USER, DB_SSL_SERVERNAME=<rds-endpoint>, NODE_EXTRA_CA_CERTS), then:
npm run db:migrate
npm run totp:reencrypt -- --dry-run   # needs CREDENTIALS_ENCRYPTION_KEY and AUTH_SECRET in this shell
```

The traffic leaves the VPC nowhere: the tunnel ends on the NAT instance, which connects to
RDS on the private network. The password is read from the rotating secret with your own
credentials at connect time and is never printed. `DB_HOST` must be the IP `127.0.0.1`
(not `localhost`), so the TLS check uses `DB_SSL_SERVERNAME`, the real RDS name.
