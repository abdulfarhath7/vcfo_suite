# Overnight M7: SOC 2 secrets, rotation and developer console

Branch `ovn/m5`. Date 2026-10-30. Not merged. Not deployed. No schema change. No migration.

Checks run: `npx tsc --noEmit -p .` (0 errors), `npx eslint <changed files>` (0 errors, 2 old
warnings in `src/db/client.ts`), `npx vitest run <related tests>` (39 files, 330 tests pass).
The app, a browser, Playwright and smoke tests were not run (owner rule). Terraform is not
installed here, so `terraform fmt` and `terraform validate` were not run.

## Owner manual steps (do these in this order)

| # | Next action | Where | Done |
|---|---|---|---|
| 1 | Run `terraform fmt` and `terraform validate` in `infra/` on your laptop. | Laptop | ✗ |
| 2 | Merge the laptop-only infra files (`private-db.tf` and others) with this branch. Check that `infra/soc-runtime.tf` and the `app.tf` changes do not clash with them. | Laptop | ✗ |
| 3 | Make a key: `openssl rand -base64 32`. Create the secret `vcfo-suite/CREDENTIALS_ENCRYPTION_KEY` with Terraform (`credentials_key_enabled = true`, first apply with `-target=aws_secretsmanager_secret.credentials_encryption_key`), then put the key with `aws secretsmanager put-secret-value`. If the laptop files already make this secret, skip the flag and use that secret. | Laptop, AWS | ✗ |
| 4 | Run `terraform plan`. Expect: a new role policy `vcfo-suite-app-console-soc-read`, new env vars on App Runner (`AZURE_AD_CLIENT_SECRET_SECRET_ID`, `ANTHROPIC_API_KEY_SECRET_ID`, `BACKUP_PLAN_ID`, `BACKUP_VAULT_NAME`, `RDS_INSTANCE_ID`), the runtime secrets `AZURE_AD_CLIENT_SECRET` and `ANTHROPIC_API_KEY` removed, `CREDENTIALS_ENCRYPTION_KEY` added. Expect no change to RDS, subnets or security groups. | Laptop | ✗ |
| 5 | Deploy the image of this branch first. Then run `terraform apply`. The old image needs `ANTHROPIC_API_KEY` and `AZURE_AD_CLIENT_SECRET`; the new image reads the `*_SECRET_ID` vars. | Laptop | ✗ |
| 6 | Open the tunnel: `node scripts/db-env-prod.mjs`. Run the printed `aws ssm start-session` command in terminal 1. Paste the printed exports in terminal 2. | Laptop | ✗ |
| 7 | In terminal 2, export `CREDENTIALS_ENCRYPTION_KEY` and `AUTH_SECRET` from Secrets Manager for this shell only. Run `npm run totp:reencrypt -- --dry-run`. Read the counts. | Laptop | ✗ |
| 8 | Run `npm run totp:reencrypt`. Expect `unreadable=0`. For each unreadable profile id, reset that person's two-step sign-in. Close the shell. | Laptop | ✗ |
| 9 | Open `/app/dev/access` and `/app/dev/data`. Check the cards "Secrets and rotation", "Backups" (AWS Backup part) and "Network". "Not connected" means a grant is missing. | Browser | ✗ |
| 10 | Rotate AUTH_SECRET by 31 Jan 2027 with the steps in `docs/context/AWS-DEPLOY.md` §11.1. Do step 8 first. | AWS | ✗ |

## 1. AUTH_SECRET rotation without sign-outs

| Item | State | Detail |
|---|---|---|
| Two signing secrets | ✓ | `src/auth/secrets.ts` gives `[AUTH_SECRET, AUTH_SECRET_PREVIOUS]`. `config.base.ts` sets `secret` to this list. New tokens use AUTH_SECRET. Old tokens still verify. A previous secret alone never signs. |
| TOTP key moved | ✓ | `src/lib/totp/secret-box.ts` seals new values as `t2` with a key from CREDENTIALS_ENCRYPTION_KEY. Old `t1` values open with AUTH_SECRET or AUTH_SECRET_PREVIOUS. |
| Fallback before the key is set | ✓ | When CREDENTIALS_ENCRYPTION_KEY is not set, new values are still sealed as `t1` (one warning). Two-step setup keeps working. |
| Re-encrypt script | ✓ | `scripts/reencrypt-totp.ts` (`npm run totp:reencrypt`, `--dry-run`). It calls `systemReencryptTotpSecrets` in the profiles repository only. Each update matches the old value. It prints counts and profile ids, never a secret. |
| Outlook tokens and state | ✓ | Side effect that rotation needs: `token-crypto.ts` and `oauth.ts` also open values made with AUTH_SECRET_PREVIOUS. Tokens are sealed again at the next refresh. |
| Terraform | ✓ | `auth_secret_previous_enabled` makes `vcfo-suite/AUTH_SECRET_PREVIOUS` (value by hand) and injects it. `ignore_changes` on the AUTH_SECRET version stops an apply from putting back the old value. |
| Unit tests | ✓ | `src/auth/secrets.test.ts` (real Auth.js JWT encode and decode across a rotation), `src/lib/totp/secret-box.test.ts`, `src/db/repositories/profiles-totp-reencrypt.test.ts`. |
| WhatsApp verify code hash | ✗ | Not changed. It uses AUTH_SECRET for a short-lived code. A code sent just before a rotation fails once; the person asks for a new code. |

## 2. Runtime secrets

| Item | State | Detail |
|---|---|---|
| Reader with cache | ✓ | `src/lib/secrets/runtime-secret.ts`: GetSecretValue when `*_SECRET_ID` is set, 10-minute cache, one shared call for parallel reads, 30-second pause after a failure. Plain text or JSON values. |
| Forced refresh | ✓ | `withSecretRetry`: on a 401 or `invalid_client`, the cache is dropped, the secret is read again, and the call runs once more if the value changed. |
| Anthropic key (376) | ✓ | `ANTHROPIC_API_KEY_SECRET_ID`. `src/lib/ask/provider/anthropic.ts` makes a new SDK client only when the key changes. |
| Azure client secret (372) | ✓ | `AZURE_AD_CLIENT_SECRET_SECRET_ID`. `src/lib/outlook/oauth.ts` token calls retry once on `invalid_client`. |
| Entra sign-in secret | ✓ | `AUTH_MICROSOFT_ENTRA_ID_SECRET_ID`. `src/auth/config.ts` now builds the Auth.js config per request (Auth.js lazy init). An `invalid_client` error drops the cache (Auth.js logger hook). If the secret cannot be read, Microsoft sign-in is left out and password sign-in works. |
| Local dev | ✓ | The plain env vars still work when no `*_SECRET_ID` is set. |
| No redeploy after rotation | ✓ | Terraform now passes the ARNs as plain env vars, not as App Runner runtime secrets. `ignore_changes` on the Azure secret version. |
| Console checks | ✓ | The Connections "Test" for Ask VCFO and Outlook, the env status and the secrets inventory know the `*_SECRET_ID` vars. |
| Unit tests | ✓ | `src/lib/secrets/runtime-secret.test.ts` (mocked client), `src/lib/secrets/app-secrets.test.ts` (Outlook and Anthropic retry with mocked fetch and SDK). |

## 3. No production DATABASE_URL

| Item | State | Detail |
|---|---|---|
| App | ✓ | `src/db/client.ts` uses DB_SECRET_ARN and the DB_* vars. DATABASE_URL is for local dev only. New optional `DB_SSL_SERVERNAME` keeps TLS verified through the tunnel. |
| Migrations | ✓ | `drizzle.config.ts` takes DB_SECRET_ARN and the DB_* vars. It reads the password with the AWS CLI at connect time. |
| Scripts | ✓ | `scripts/db-url-prod.mjs` is removed. `scripts/db-env-prod.mjs` prints the SSM tunnel command and the exports, and no password. `scripts/db-connect.mjs` serves the plain `pg` scripts (`backfill-step-events.mjs`). Comments in `compliance-generate.ts` and `load-env.ts` are updated. |
| Developer console | ✓ | The secrets inventory lists DB_SECRET_ARN, not DATABASE_URL. |
| Health check | ✓ | App Runner checks `/robots.txt`. It never used DATABASE_URL. |
| Docs | ✓ | `AWS-DEPLOY.md`, `infra/README.md`, `HOW-TO-BUILD.md`, `docs/specs/ask-vcfo/STATUS.md`, `.env.example`. |
| Terraform | ✓ | `db_managed_password` default is now `true`. The `false` path stays only for a fresh stack. |

## 4. Developer console

| Item | State | Detail |
|---|---|---|
| Secrets and rotation | ✓ | Access page. Per secret: last rotated (DescribeSecret; rotated, else changed, else created), rotation, next due, review date, status. 371 and 376 every 90 days, review 31 Jan 2027. 372 every 6 months, review 30 Apr 2027. RDS auto-rotation: on or off, days, next rotation, secret status. Red only when past due. |
| Backups | ✓ | The Backups card keeps the RDS snapshots and adds the AWS Backup plan `vcfo-suite-db`: schedule ("Daily 02:00 IST"), kept 30 days, recent recovery points. |
| Network | ✓ | Data page. VPC connector status, NAT instance (or NAT gateway) status, and "RDS private ✓" when PubliclyAccessible is false. |
| Not connected | ✓ | An IAM refusal or no AWS credentials shows "Not connected", per card and per row. |
| IAM grants | ✓ | `infra/soc-runtime.tf`, read only: `secretsmanager:DescribeSecret` on the vCFO secrets, `backup:GetBackupPlan` on the plan, `backup:ListRecoveryPointsByBackupVault` on the vault, `ec2:DescribeInstances` and `ec2:DescribeNatGateways` (no resource scoping exists; limited to ap-south-1), `apprunner:DescribeVpcConnector` on `vpcconnector/vcfo-suite*`, `rds:DescribeDBInstances` on the DB. |
| Not in the spec | ✓ | `apprunner:DescribeService` on `service/vcfo-suite/*`, so the card finds the connector ARN without a new env var. Remove it and set `APP_RUNNER_VPC_CONNECTOR_ARN` if you do not want it. |
| SOC controls | ✓ | No public RDS, no `0.0.0.0/0`, no removed resource policy. The two new secrets get the same deny-all policy. |
| Unit tests | ✓ | `src/lib/dev/rotation.test.ts`, `src/lib/dev/soc.test.ts` (mocked AWS clients, "Not connected" paths). |

## 5. Docs and env

| Item | State | Detail |
|---|---|---|
| `docs/context/AWS-DEPLOY.md` | ✓ | New §11: SOC 2 posture, rotation steps for 371, 372 and 376, runtime secrets, migrations through the SSM tunnel on the NAT instance. Old public-RDS steps are replaced. |
| `docs/context/STATE.md` | ✓ | M7 row. Laptop-only network files listed as deferred. |
| `.env.example` | ✓ | DB_* vars, DB_SSL_SERVERNAME, AUTH_SECRET_PREVIOUS, the three `*_SECRET_ID` vars, BACKUP_PLAN_ID, BACKUP_VAULT_NAME, APP_RUNNER_VPC_CONNECTOR_ARN, NAT_INSTANCE_ID. |

## Limits and risks

| Item | Detail |
|---|---|
| Infra files | Only the infra files in git were edited: `app.tf`, `database.tf`, `variables.tf`, `outputs.tf`, new `soc-runtime.tf`. The laptop-only files (`private-db.tf` and others) were not seen. `network.tf` in git still shows the old public pilot; it was not changed. |
| New dependencies | `@aws-sdk/client-backup` and `@aws-sdk/client-ec2` (3.1160.0, the release of the other AWS clients) are in `package.json` and `package-lock.json`. They were copied into the shared `node_modules` for the checks; nothing else there changed. Run `npm ci` once. |
| Auth.js lazy init | The Auth.js config is now a function. Typecheck and unit tests pass, but sign-in was not tested in a browser. Test password, two-step and Microsoft sign-in after deploy. |
| Auth.js error log | A custom logger keeps the Auth.js error format and adds the cache drop. Debug and warn logs are unchanged. |
| SSM tunnel | Needs the Session Manager plugin on the laptop and the SSM agent and role on the NAT instance. `DB_HOST` must be `127.0.0.1`, not `localhost`. |
