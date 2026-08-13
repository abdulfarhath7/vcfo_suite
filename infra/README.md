# infra/ — AWS deployment (Stage 2)

Not needed for the local pilot. When you're ready to go beyond the office:

1. `terraform init` (configure the S3 backend first)
2. `terraform apply` — creates RDS (Mumbai), S3, KMS keys
3. Point production env vars at the RDS endpoint + S3 bucket
4. Build the container, push to ECR, deploy via App Runner (or Lightsail if App Runner unavailable)
5. Run `npm run db:migrate` against RDS, then `npm run db:seed` (or import data)

Full runbook + env map: **`docs/context/AWS-DEPLOY.md`**.

The app code does not change between local and AWS — only env vars.
Keep Resend for the first AWS cut; SES is a later swap.
