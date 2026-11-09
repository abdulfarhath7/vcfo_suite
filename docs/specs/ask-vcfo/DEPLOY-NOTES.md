# Ask VCFO: deploy notes for branch `chatbot`

What production needs before the Answer, Do and Watch engines go live. Nothing here has been run against RDS or
App Runner; this branch was never deployed. The runbook itself is `docs/context/AWS-DEPLOY.md`.

## Migrations

| Migration | On `main` | On RDS (main's deploy record of 9 Nov 2026) | What it adds |
|---|---|---|---|
| `0047_ask_foundation` | yes | applied | Every Ask and Watch table, the `vector` extension, `ask_index_items.embedding vector(512)` |
| `0048_budgets` | yes | applied | Budget module (not Ask) |
| `0049_budget_variance` | yes | applied 9 Nov | Budget variance (not Ask) |
| `0050_ask_row_edited` | **no, this branch only** | **not applied** | `ask_changeset_rows.edited_at`, so "accepted without an edit" can be counted |

Only `0050_ask_row_edited` is new. It is one additive `ALTER TABLE ... ADD COLUMN` with no default, so it is quick and
safe on a live table. Take the usual snapshot first, then apply it through the SSM tunnel with `npm run db:migrate`.
`src/db/migrations-journal.test.ts` holds the journal order.

## The `vector` extension

`0047_ask_foundation` begins with `CREATE EXTENSION IF NOT EXISTS vector`. On RDS only a role with `rds_superuser` may
create an extension. Main's deploy record says RDS already holds 0047, so the extension exists. Confirm it once:

```sql
select extname, extversion from pg_extension where extname = 'vector';
```

If a fresh RDS instance is ever built, the master user (which has `rds_superuser`) must run the migration, or run
`CREATE EXTENSION vector;` itself first. pgvector ships with RDS for PostgreSQL 16, so no parameter group change is needed.

## Local Postgres image

`docker-compose.yml` now uses `pgvector/pgvector:pg16` instead of `postgres:16`. The data directory format is the same,
so an existing `vcfo-pgdata` volume keeps working: `docker compose pull postgres` and `npm run db:up` recreate the
container on the new image. Without it, `0047` fails on `CREATE EXTENSION vector`.

## Environment flags

Production defaults are what the code does when the variable is unset. Terraform (`infra/app.tf`) sets only
`ASK_VCFO_ENABLED`, `ASK_VCFO_LLM_PROVIDER`, `ANTHROPIC_API_KEY_SECRET_ID` and the `ASK_VCFO_FEATURE_*` list today, so
every row below runs on its production default until it is added there.

| Variable | Production default | Notes |
|---|---|---|
| `ASK_VCFO_ENABLED` | off (Terraform sets `true`) | Hides the chat and 404s `/api/ask/*` when off |
| `ASK_VCFO_LLM_PROVIDER` | `anthropic` | `bedrock` needs `ASK_VCFO_BEDROCK_REGION` |
| `ANTHROPIC_API_KEY_SECRET_ID` | none | Secret ARN; the key is read at runtime |
| `ASK_VCFO_MODEL_GUARD`, `_ANSWER`, `_CONTEXTUALIZER`, `_DOCUMENT`, `_EXTRACT`, `_WATCH` | `claude-haiku-5-5` | |
| `ASK_VCFO_MODEL_AGENT` | `claude-sonnet-5-5` | Agent runs only |
| `ASK_VCFO_ANSWER_EFFORT` | `low` | `medium` or `high` raise answer quality and cost |
| `ASK_VCFO_RATE_LIMIT_HOUR`, `_DAY` | 30, 200 | Model answers per person |
| `ASK_VCFO_RETRIEVAL_TOP_K` | 4 | Sources sent to the model |
| `ASK_VCFO_REFUSAL_FALLBACK` | on | Never sent on Haiku models |
| `ASK_VCFO_FEATURE_C1` to `C5`, `A1` | off | Older optional features, unchanged |
| `ASK_EMBEDDINGS_PROVIDER`, `_REGION`, `_MODEL` | `none`, empty, `amazon.titan-embed-text-v2:0` | `none` searches full text only |
| `WATCH_ENABLED` | **off in production**, on elsewhere | Portal checks and the Watch pipeline |
| `WATCH_ALERT_MAILBOX`, `WATCH_ALERT_TOKEN` | empty | Both are needed or `POST /api/watch/mail` answers 404 |
| `ASK_ID_DOC_READING` | off | Identity documents in the data router |
| `ASK_ASSIST_HANDOFF_ENABLED` | off | `filing.prepareRun`; also needs `VCFO_ASSIST_ENABLED` |
| `VCFO_ASSIST_ENABLED` | off | The existing VCFO Assist link |
| `ASK_PROACTIVE_ENABLED` | off | The 02:30 IST `ask-proactive` job |
| `ASK_KILL_PATHS`, `ASK_KILL_TIERS` | empty | Comma lists from `src/lib/ask/paths.ts` and `T0` to `T3` |
| `ASK_RUN_MAX_TURNS`, `ASK_RUN_MAX_TOKENS` | 12, 200,000 | One agent run |
| `ASK_ANSWER_MAX_TOKENS` | 40,000 | One chat answer across its tool rounds |
| `ASK_DAILY_TOKEN_BUDGET` | 2,000,000 | Every path together, per IST day |
| `ASK_AGENT_RUNS_PER_HOUR` | 6 | Per person |

`ASK_ACTIONS_DB`, `ASK_PROACTIVE_DB`, `ASK_EVAL_*` and `ASK_E2E_LIVE` are test switches and never belong in production.

## Background jobs need Inngest

Agent runs (`ask-run`), the Watch pipeline (`watch-check`, `watch-process`, `watch-daily-summary`), the nightly index
sweep (`ask-index-sweep`), `ask-proactive` and document ingestion all run under Inngest. `docs/context/STATE.md` still
lists Inngest cloud keys as not set on AWS. Until `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are set and the app is
synced, an agent run answers "This could not start just now", no cron fires, and only work that falls back to running
in the request (document ingestion) works. Answers, metrics, saved answers and the paste-and-file card do not need it.

## Before turning on `WATCH_ENABLED`

- Read each source's site terms; the crawler keeps its real name and contact URL, obeys robots rules and crawl delays,
  and never logs in or solves a CAPTCHA, but the terms are the owner's call.
- Inngest is synced (above), because the checks are cron jobs.
- Check outbound HTTPS from App Runner reaches the public sources; nothing has been run from AWS yet.
- Decide who reviews. Only `isAdminOrManager` roles publish, and `important` updates ring every bell at publish.
- Expect manual sources (MCA, Income Tax India, CBIC tax information, GST news) to show on the health screen as manual.
- `announcement-feeds` stops posting once Watch is on, so the board does not show a feed twice.

## Before turning on `ASK_ID_DOC_READING`

- Counsel's view on DPDP for reading PAN, Aadhaar and passport images, as `.env.example` says.
- Test only with synthetic documents (`tests/ask/evals/fill/fixtures`) until then.
- Identity numbers are masked in chat, logs, stored prompts and run steps; read files keep their model reading beside the
  object as `<s3Key>.read.json` in the same bucket, so the bucket's retention covers it.

## Before turning on `ASK_ASSIST_HANDOFF_ENABLED`

- The written CS opinion on the VCFO Assist hand-off.
- `VCFO_ASSIST_ENABLED` on as well, with the extension installed for the staff who will use it.
- The remaining Part B field bindings in `src/lib/assist-profile/` are not done, and no live MCA run has been made.
- The action only stores a `requested` `assist_runs` row after a person accepts its card; a person still logs in, signs,
  pays, submits and records the SRN.

## Before turning on `ASK_PROACTIVE_ENABLED`

- Inngest is synced, because the job is a 02:30 IST cron.
- The owner agrees to the fixed rules: overdue requests and filings waiting on the client, files unreviewed for two days,
  and due date changes waiting on Watch. At most ten rows a card and ten cards a night, and a row stays quiet for 14 days.
- The job calls no model and only leaves cards; `src/lib/ask/proactive/no-auto-apply.test.ts` proves it cannot apply one.
- Watch the cards per action on the token page (`/app/admin/ask-vcfo/usage`, super admin) for a week before relying on it.

## After deploy

- Sign in as a super admin and open `/app/admin/ask-vcfo/usage` to see spend per path.
- Run `npm run ask:knowledge:load` through the tunnel once, so obligation texts, the statutory calendar and the playbook
  are searchable; it reports what it could not load.
- Run `npm run ask:catalog` only if a checklist source changed since this branch; `catalog.test.ts` fails when it is stale.
