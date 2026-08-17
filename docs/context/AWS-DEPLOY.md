# AWS deploy checklist (Stage 2)

**Goal:** run VCFO Suite on AWS with the same code as local — only env vars change.  
**Region:** `ap-south-1` (Mumbai).  
**Email for v1:** keep **Resend** (`EMAIL_PROVIDER=resend`). SES is ready behind
`EMAIL_PROVIDER=ses` — flip only after identity + (usually) production access.

This is a **paid-plan pilot**, not “forever free.” Set a billing alarm on day one.

**Finance architecture pack** (product, request path, AWS + Twilio billable services, SES replacing Resend): open [`docs/architecture/vcfo-aws-architecture.html`](../architecture/vcfo-aws-architecture.html) in a browser and print to PDF. This file remains the engineering deploy checklist.

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
| `infra/database.tf` | RDS Postgres stub (needs VPC/SG) |
| `infra/storage.tf` | S3 + KMS + public block + versioning |
| `infra/app.tf` | **Stub only** — ECR/App Runner not written |
| `Dockerfile` | **Missing** — add before container deploy |
| App ↔ DB / S3 / Auth | Ready via env (see §4) |

Until Terraform is finished, you can provision the same pieces in the **console** or CLI. Terraform is preferred once VPC is designed.

---

## 2. Recommended architecture (smallest that fits this app)

```
Internet
   │
   ▼
App Runner (or Lightsail container)  ← Next.js (`npm run build` + `next start`)
   │
   ├── RDS Postgres 16 (private if possible; public + SG lock for first pilot OK)
   ├── S3 private bucket (documents)
   └── Resend (external HTTPS) — SES later
```

**Backup if App Runner is unavailable for new accounts:** Lightsail container or a single small EC2 + Docker. Same image, same env.

**Do not use for v1:** EKS, Lambda-per-route, Cognito (Auth.js already handles auth), CloudFront (optional later).

---

## 3. Provision order (manual or Terraform)

### 3.1 Networking (minimum for pilot)

- [ ] Default VPC is fine for first pilot **if** RDS SG only allows the app’s SG / your IP
- [ ] Later: private subnets + no public RDS (`infra/database.tf` already sets `publicly_accessible = false` — that requires VPC wiring first)

### 3.2 RDS Postgres

- [ ] Engine: PostgreSQL **16**
- [ ] Class: **`db.t4g.micro`**
- [ ] Storage: 20 GB gp3, encrypted
- [ ] DB name: `vcfo`
- [ ] Master user: `vcfo` (password in Secrets Manager / strong random)
- [ ] Backup retention ≥ 7 days
- [ ] Security group: inbound **5432** only from app (or your laptop IP for migrate)

Connection string shape:

```text
postgresql://vcfo:PASSWORD@HOST:5432/vcfo?sslmode=require
```

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
- [ ] Map custom domain when ready (Route53 or Cloudflare CNAME)

### 3.5 Secrets

Store in **Secrets Manager** or App Runner encrypted env (not in git / not in image):

- `DATABASE_URL`
- `AUTH_SECRET`
- `RESEND_API_KEY`
- S3 keys **only if** not using instance role

---

## 4. Env var map (local → AWS)

Copy from `.env.example`. Production values:

| Variable | Local | AWS |
|---|---|---|
| `DATABASE_URL` | docker Postgres | RDS URL + `?sslmode=require` |
| `AUTH_SECRET` | random | **new** random (`openssl rand -base64 32`) |
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
3. [ ] From a trusted machine with `DATABASE_URL` pointing at RDS:
   ```bash
   npm run db:migrate
   # optional demo users:
   npm run db:seed
   ```
4. [ ] Open `AUTH_URL` → login as seeded admin
5. [ ] Smoke test:
   - [ ] Create project (auto-creates client)
   - [ ] Client KYC submit
   - [ ] Manager/admin Accept/Reject
   - [ ] Upload a document (hits S3)
   - [ ] Trigger one progress email (Resend dashboard shows delivery)
6. [ ] Turn off any public RDS once migrate is done (or lock SG to app only)

---

## 6. Terraform path (when you prefer IaC)

Current stubs live under `infra/`. Suggested finish order:

1. [ ] `network.tf` — VPC / subnets / SGs (required for private RDS)
2. [ ] Wire `database.tf` to those subnets + SG
3. [ ] Keep `storage.tf` (already useful)
4. [ ] Flesh out `app.tf` — ECR + App Runner + IAM role + secret ARNs
5. [ ] Uncomment S3 backend in `main.tf` for remote state
6. [ ] `terraform apply` with `-var='db_password=...'` (never commit tfvars with secrets)

Until then, console provisioning is acceptable for one pilot environment.

---

## 7. Domain + HTTPS

- [ ] App Runner custom domain **or** Cloudflare proxy to the service URL
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

Rough ballpark if you stay small: **~$15–40 / month** (micro RDS + small container + S3 + light egress). Credits may cover the first weeks; they will not cover forever. That figure is **before Twilio WhatsApp**. Full billable-service map for Finance: [`docs/architecture/vcfo-aws-architecture.html`](../architecture/vcfo-aws-architecture.html).

---

## 10. Go / no-go

**Go to AWS when:** local/LAN pilot is boringly reliable and you need offsite access.

**Stay local when:** still changing KYC/assignment flows daily — deploy churn will slow you down more than hosting helps.
