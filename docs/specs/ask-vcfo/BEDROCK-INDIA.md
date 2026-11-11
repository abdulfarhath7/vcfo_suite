# Ask VCFO on Amazon Bedrock with India data residency

Status: built 2026-11-10, **not applied, not deployed**. The production default in Terraform is now
Bedrock in Mumbai with India residency. Until the owner finishes the steps below, do not apply
Terraform with `ask_vcfo_enabled = true`, or Ask VCFO will refuse every model call (it will not fall
back to the Anthropic API).

Why: the legal review (`docs/specs/mca-connect/reports/VCFO Assist legal review.md`, AI data flow;
research notes `.../research_notes/VCFO Assist legal review/ai_provider_terms.md`) found that production
sends prompts to the Anthropic API, which has no India processing option. On Bedrock, AWS is the only
processor, Anthropic has no access to prompts, retention can be set to `none`, and the India
geographic inference profile keeps inference in ap-south-1 (Mumbai) and ap-south-2 (Hyderabad).

## How the code behaves

| Setting | Effect |
| --- | --- |
| `ASK_VCFO_LLM_PROVIDER=bedrock` | Bedrock. `ASK_VCFO_DATA_RESIDENCY` then defaults to `india`. |
| `ASK_VCFO_DATA_RESIDENCY=india` (any value except `none`) | The bedrock-runtime client (`AnthropicBedrock`, InvokeModel) with its base URL pinned to `https://bedrock-runtime.<region>.amazonaws.com`. The region must be `ap-south-1` or `ap-south-2`. Every tier's model id must start with `in.`. Checked when the provider is first resolved and again before every call. A bad setting logs one `[ask-vcfo] refusing every model call: …` line and every call fails with `AskResidencyError`; a Bedrock error fails with `AskBedrockError`. Nothing falls back to the Anthropic API, to Mantle or to a Global profile. `ASK_VCFO_MODEL_*` is ignored. |
| `ASK_VCFO_DATA_RESIDENCY=none` with Bedrock | The old Mantle path with `anthropic.*` ids. Anthropic lists Mumbai as "Global" only on Mantle, so this can leave India. |
| `ASK_VCFO_LLM_PROVIDER=anthropic` | Works as before (local dev). Logs a one-time warning that prompts leave India. With `ASK_VCFO_DATA_RESIDENCY=india` it refuses every call. |

Model tiers in India mode:

| Variable | Tiers | Default (confirm in the console) |
| --- | --- | --- |
| `ASK_VCFO_BEDROCK_MODEL_FAST` | guard, answer, contextualizer, document, extract, watch | `in.anthropic.claude-haiku-4-5-20251001-v1:0` |
| `ASK_VCFO_BEDROCK_MODEL_SMART` | agent | `in.anthropic.claude-sonnet-5` |
| `ASK_VCFO_BEDROCK_MODEL_<TIER>` | one tier, for example `ASK_VCFO_BEDROCK_MODEL_DOCUMENT=in.anthropic.claude-sonnet-5` | none |

Other differences from the Anthropic API path: Haiku 4.5 replaces Haiku 5.5 and Sonnet 5 replaces
Sonnet 5.5, because AWS lists only Opus 5, Sonnet 5 and Haiku 4.5 on the India profile. Haiku 4.5
rejects the `effort` parameter, so the adapter drops it for that model. Bedrock has no server-side
refusal fallback, so `ASK_VCFO_REFUSAL_FALLBACK` has no effect. Usage rows record the `in.` id, and
cost reports price it at list price plus an estimated 10 percent geographic premium
(`src/lib/ask/provider/pricing.ts`); check the Bedrock pricing page for ap-south-1.

Code: `src/lib/ask/provider/{residency,bedrock,index,pricing}.ts`, `src/lib/ask/config.ts`; tests beside
them. Terraform: `infra/variables.tf` (`ask_vcfo_llm_provider`, `ask_vcfo_data_residency`,
`ask_vcfo_bedrock_region`, `ask_vcfo_bedrock_model_fast`, `ask_vcfo_bedrock_model_smart`,
`ask_vcfo_bedrock_extra_models`), `infra/app.tf` (env vars and the IAM grant), `infra/database.tf`
(the Anthropic key secret is looked up only with the anthropic provider).

## Owner steps

Run these in the shared AWS account with an admin profile. Nothing here was run by Claude.

### 1. Enable model access in Mumbai and Hyderabad

1. Console, region **Asia Pacific (Mumbai) ap-south-1**, Amazon Bedrock, **Model access**.
2. Enable **Claude Haiku 4.5** and **Claude Sonnet 5** (and Claude Opus 5 if you plan a per-tier
   override). Anthropic's page says both are open to all Bedrock customers; a first-time Anthropic
   use-case form may still appear.
3. Repeat in **Asia Pacific (Hyderabad) ap-south-2**, which is the profile's other destination.

### 2. Confirm the India profile ids

```bash
aws bedrock list-inference-profiles --region ap-south-1 --type-equals SYSTEM_DEFINED \
  --query "inferenceProfileSummaries[?starts_with(inferenceProfileId, 'in.')].[inferenceProfileId,inferenceProfileName]" \
  --output table

aws bedrock get-inference-profile --region ap-south-1 \
  --inference-profile-identifier in.anthropic.claude-sonnet-5 \
  --query "models[].modelArn"
```

- The first command must list the two ids in the table above. If they differ (for example a `-v1:0`
  suffix on Sonnet 5), put the console ids in `terraform.tfvars` as `ask_vcfo_bedrock_model_fast` and
  `ask_vcfo_bedrock_model_smart`.
- The second must show foundation models in **only** ap-south-1 and ap-south-2. The IAM grant in
  `infra/app.tf` assumes the foundation model id is the profile id without `in.`
  (`arn:aws:bedrock:<region>::foundation-model/anthropic.claude-sonnet-5`). If the ARNs printed here
  differ, tell Claude so the grant can be corrected before apply.

### 3. Set Bedrock data retention to `none` in both India regions

Retention is per region and has no console page yet; it is set through the Bedrock API. For the
bedrock-runtime endpoint the app uses, the account setting is on the Bedrock control plane:

```bash
for region in ap-south-1 ap-south-2; do
  curl -sS -X PUT "https://bedrock.${region}.amazonaws.com/data-retention" \
    --aws-sigv4 "aws:amz:${region}:bedrock" \
    --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
    -H "x-amz-security-token: $AWS_SESSION_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "mode": "none" }'
  echo
  curl -sS "https://bedrock.${region}.amazonaws.com/data-retention" \
    --aws-sigv4 "aws:amz:${region}:bedrock" \
    --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
    -H "x-amz-security-token: $AWS_SESSION_TOKEN"
  echo
done
```

Both GET calls must print `"mode": "none"`. Drop the `x-amz-security-token` line when you use long-term
keys; with SSO, export the temporary keys first (`aws configure export-credentials --format env`).
AWS also documents a bearer-token form (`-H "Authorization: Bearer $AWS_BEARER_TOKEN_BEDROCK"`).

Notes:

- `none` works for Haiku 4.5, Sonnet 5 and Opus 5. Claude Fable and Mythos models require
  `aws_review` (30 days of retention with possible AWS human review) and are blocked under `none`.
  Do not configure them for Ask VCFO.
- Optional, to make it stick: an SCP that denies `bedrock:PutAccountDataRetention` (and
  `bedrock-mantle:PutAccountDataRetention`) unless `bedrock:DataRetentionMode` (or
  `bedrock-mantle:DataRetentionMode`) equals `none`. The account is shared with other teams, so agree
  this with them first.
- Source: [Bedrock data retention](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html).

### 4. Terraform variables

The defaults already are the production values. In `terraform.tfvars` you only need
`ask_vcfo_enabled = true` (already set) plus any id corrections from step 2:

```hcl
ask_vcfo_llm_provider        = "bedrock"     # default
ask_vcfo_data_residency      = "india"       # default
ask_vcfo_bedrock_region      = "ap-south-1"  # default
ask_vcfo_bedrock_model_fast  = "in.anthropic.claude-haiku-4-5-20251001-v1:0"  # confirm
ask_vcfo_bedrock_model_smart = "in.anthropic.claude-sonnet-5"                 # confirm
```

Terraform validation refuses a non-India region or a model id without `in.` while residency is
`india`, and refuses `anthropic` with `india`.

### 5. Deploy

1. Build and push the image with this code first; the old image ignores the new variables and still
   calls the Anthropic API with no key.
2. `terraform plan`. Expect: the App Runner env drops `ANTHROPIC_API_KEY_SECRET_ID` and gains
   `ASK_VCFO_LLM_PROVIDER=bedrock`, `ASK_VCFO_DATA_RESIDENCY=india`, `ASK_VCFO_BEDROCK_REGION`,
   `ASK_VCFO_BEDROCK_MODEL_FAST` and `_SMART`; the app role policy loses the Anthropic secret and
   gains `AskBedrockIndiaProfiles` and `AskBedrockIndiaModels`; the secret lockdown policy drops the
   Anthropic secret. Nothing else.
3. `terraform apply`.
4. After step 6 passes, the secret `/vcfo/ask-vcfo/anthropic-api-key` is no longer read. Delete it
   (or keep it for a rollback; rollback is `ask_vcfo_llm_provider = "anthropic"` plus
   `ask_vcfo_data_residency = "none"`).

### 6. Verify

1. From a laptop with the admin profile (needs `npm install`):

   ```bash
   node scripts/ask-bedrock-check.mjs --dry-run --all   # no AWS call; shows region and ids
   node scripts/ask-bedrock-check.mjs --all             # two tiny calls per model
   ```

   Each model must print `OK` twice: the plain reply, then the structured (JSON) reply that the guard,
   the field resolver and extraction depend on. The script prints the requested id, the response model
   and the region.
2. CloudTrail in ap-south-1: the `InvokeModel` events (event source `bedrock.amazonaws.com`) name the
   `in.` profile.
3. In the app, ask Ask VCFO one question as admin. App Runner logs must show no
   `[ask-vcfo] refusing every model call` line and no `AskBedrockError`.
4. The developer console's Ask usage report shows `in.anthropic.*` model ids.
5. Run the live evals with Bedrock (`npm run eval:live`) before relying on Haiku 4.5 for answers;
   the earlier evals ran on Haiku 5.5 and Sonnet 5.5.

Embeddings are separate: if `ASK_EMBEDDINGS_PROVIDER=bedrock` is ever turned on, set
`ASK_EMBEDDINGS_REGION=ap-south-1` (Titan v2 availability in Mumbai not checked here).

## What was verified (10 November 2026)

Verified from the live pages:

- AWS blog of 29 September 2026: the India profile routes only between ap-south-1 and ap-south-2;
  models Opus 5, Sonnet 5 and Haiku 4.5; ids `in.anthropic.claude-sonnet-5`,
  `in.anthropic.claude-opus-5` and `in.anthropic.claude-haiku-4-5-20251001-v1:0`; the examples use the
  bedrock-runtime endpoint (InvokeModel, Converse, and the Messages API at
  `https://bedrock-runtime.ap-south-1.amazonaws.com/anthropic`), not Mantle.
  ([AWS ML blog](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-expands-claude-model-availability-to-india-cross-region-inference/))
- Anthropic's Mantle page lists ap-south-1 and ap-south-2 as "Global" only, with geographic profiles
  US, EU, JP and AU only. ([Claude in Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock))
- The IAM pattern for geographic profiles: allow the profile ARN, and the foundation model in the
  source and every destination region, conditioned on `bedrock:InferenceProfileArn`.
  ([Geographic cross-Region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/geographic-cross-region-inference.html))
- Retention modes, the control-plane `PUT /data-retention` route for bedrock-runtime, and no console UI.
  ([Bedrock data retention](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html))
- `@anthropic-ai/bedrock-sdk` 0.34.0 `AnthropicBedrock` posts to `/model/<id>/invoke` on
  `bedrock-runtime.<region>.amazonaws.com` with `anthropic_version: bedrock-2023-05-31`.

Not verified (check in the Mumbai console, step 2 and step 6):

- That the ids above are exactly what the console lists today (the blog's Haiku id had a stray space).
- Whether Mantle accepts `in.` ids. The code does not rely on it.
- The foundation model ARNs behind each profile, which the IAM grant assumes.
- Structured outputs (`output_config.format`) on Haiku 4.5 through bedrock-runtime; the check script
  tests it.
- The ap-south-1 price and the 10 percent premium used in cost reports.
