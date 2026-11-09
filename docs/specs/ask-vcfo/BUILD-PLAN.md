# Ask VCFO build plan

Companion to `MASTER-PLAN.txt`, which holds the reasons. This file holds the exact files, seams,
contracts and flags, so parallel tracks do not collide. If a track must leave this plan, it records
why in its own section at the bottom and says so in its result.

## Base already in place (Foundation)

- Migration `0047_ask_foundation`: **all** schema for phases 0 to 9. Do not add a migration unless a
  column is truly missing; if one is, take the next number after rebasing and report it.
  Tables are in `src/db/schema-ask.ts` and `src/db/schema-watch.ts`; new columns on `ask_messages`,
  `ask_documents`, `ask_chunks`, `announcement_sources` and `announcements` are in `src/db/schema.ts`.
- Contracts: `src/lib/actions/types.ts`, `src/lib/actions/registry.ts`, `src/lib/ask/paths.ts`,
  `src/lib/ask/metrics/types.ts`, `src/lib/ask/embeddings/types.ts`, `src/lib/ask/changeset/types.ts`,
  `src/lib/watch/types.ts`, `src/lib/ask/mask.ts`.
- Config: `askFlags()`, `askBudgets()`, `askEmbeddingsConfig()` and the new models in
  `src/lib/ask/config.ts`.
- Dependencies are installed, so no track touches `package.json` for these: `unpdf` (PDF text) and
  `@aws-sdk/client-bedrock-runtime` (Titan embeddings; import it lazily).
- Local data: `vcfo_chatbot` is migrated and seeded, and is the template for track databases:
  `CREATE DATABASE vcfo_<track> TEMPLATE vcfo_chatbot` on `localhost:5544`.

## Manual first (owner rule, 9 November 2026)

Ask VCFO is optional. Every task can be done on its own screen, and the chat opens only when the person
asks for it. A button that does a task, such as Request a change, Approve or Upload, does that task in the
app and never opens the chat, in any state. Only a control labelled as asking, such as "Ask VCFO" or
"What's this?", may open the chat. When a task cannot run in the current state, the screen says why and
offers the manual next step.

## Facts that differ from the master plan

- `src/lib/ask/access.ts` already admits manager and intern (F-298, 29 Oct), so decision 2 needs tests,
  not a change. Developer stays out.
- Phase 0's "read real usage from production" needs RDS, which is off limits overnight. Build
  `scripts/ask-usage-report.ts` for the owner to run, and measure tonight with `eval:live`.
- Claude Haiku 5.5 thinks by default, thinking counts toward `max_tokens`, and it has **no server-side
  refusal fallback**. So: read blocks by type (guard.ts already does), give the router at least 1,024
  `maxTokens`, use `effort: 'low'` as the lever rather than disabling thinking, do not send `fallbacks`
  on Haiku, and handle `stop_reason: 'refusal'` before reading content. `anthropic.ts` sends
  `fallbacks` on every call today, which the answer track fixes in phase 0.
- Sonnet 5.5 and Opus 5.5 refuse forced `tool_choice` with a 400. Use `auto`, `strict: true`, and an
  instruction naming the tool. Thinking blocks must be passed back unchanged and history stays
  append-only, or the agent loop's replayed thinking is invalidated.

## Tracks and file ownership

Only the owner edits a path. A track that needs a change in another track's path adds the smallest seam
named here. Shared one-line registrations are listed under "Shared lines".

| Track | Phases | Owns |
|---|---|---|
| answer | 0, 1, 2 | `src/lib/ask/{pipeline,guard,generate,retrieve,refusals,suggestions}.ts`, `src/lib/ask/provider/*`, `src/lib/ask/ingest/*`, `src/lib/ask/tools/*`, `src/lib/ask/metrics/*`, `src/lib/ask/local-match.ts`, `src/lib/ask/embeddings/*`, `src/lib/ask/index-cards/*`, `src/lib/ask/knowledge-version.ts`, `src/lib/ask/question-key.ts`; repositories `ask-metrics.ts`, `ask-index.ts`, `ask-saved-answers.ts`, `ask-usage.ts`, `ask-messages.ts`, `ask-documents.ts`; jobs `ask-index-refresh.ts`; `tests/ask/evals/*` except `fill/`; `app/app/admin/ask-vcfo/usage/`, `app/api/ask/admin/usage/` |
| watch | 3, 6 | `src/lib/watch/*`, `src/lib/notifications/announcements.ts` (allowlist, kinds), `src/db/repositories/{announcements,reg-updates,reg-sources}.ts`, `src/jobs/{announcement-feeds,watch-check,watch-process,watch-daily-summary,watch-mailbox}.ts`, `app/api/watch/*`, `src/views/watch/*`, `src/components/watch/*`, `app/app/*/watch/`, `docs/context/notes/notifications.md` |
| do | 4, 5 | `src/lib/ask/field-catalog/*`, `src/lib/ask/data-router/*`, `src/lib/ask/changeset/*`, `src/lib/ask/agent/*`, `src/lib/ask/do/*`, `src/lib/actions/{types,registry}.ts`, `src/lib/actions/{tasks,requests,reminders,documents,statuses,checklist}/*`; repositories `ask-changesets.ts`, `ask-runs.ts`, `ask-attachments.ts`, `ask-memories.ts`; `src/jobs/ask-run.ts`; `app/api/ask/{attachments,changesets,runs}/*`; `src/components/ask/{AskComposer,AskChangesetCard,AskRunProgress}.tsx`, `src/components/ask/AskThread.tsx`, `src/components/ask/AskProvider.tsx`; `tests/ask/evals/fill/*`; `src/data/ask/schema.ts` (two optional fields below) |
| packs | 7 | `src/lib/actions/{compliance,registrations,board-meetings,receivables,labour,client-portal}/*`, plus the smallest extraction of a route's rules into `src/lib/<area>/` where the action must obey them |
| final | 8, 9 | `src/lib/actions/filing/*`, `src/lib/ask/proactive/*`, `src/jobs/ask-proactive.ts`, `e2e/ask-*.spec.ts`, `docs/context/STATE.md`, `docs/STATUS.md`, `docs/specs/ask-vcfo/STATUS.md`, `CLAUDE.md`, and the merge of all tracks |

Shared lines, each one append-only and small enough to merge by hand:

- `app/api/inngest/route.ts`: one import and one entry per job.
- `src/lib/ask/pipeline.ts`: the do track gets exactly the seam named below, and the answer track writes
  it. The do track supplies `src/lib/ask/do/entry.ts`.
- A route that holds rules an action must also obey is edited by whichever track extracts them, keeping
  behaviour identical and its tests passing.

Suggested dev ports if a task names none: answer 3101, watch 3102, do 3103, packs 3104, final 3100.

## Flags and kill switches

| Env | Reader | Default | Local |
|---|---|---|---|
| `ASK_VCFO_ENABLED` | `askConfig().enabled` | off | on |
| `WATCH_ENABLED` | `askFlags().watch` | off in production, on elsewhere | on |
| `ASK_ID_DOC_READING` | `askFlags().idDocReading` | off | on, synthetic data only |
| `ASK_ASSIST_HANDOFF_ENABLED` | `askFlags().assistHandoff` | off | on |
| `ASK_PROACTIVE_ENABLED` | `askFlags().proactive` | off | on |
| `ASK_KILL_PATHS`, `ASK_KILL_TIERS` | `askFlags().killedPaths`, `.killedTiers` | empty | empty |
| `ASK_RUN_MAX_TURNS`, `ASK_RUN_MAX_TOKENS`, `ASK_DAILY_TOKEN_BUDGET` | `askBudgets()` | 12, 200,000, 2,000,000 | same |
| `ASK_AGENT_RUNS_PER_HOUR` | `askBudgets().agentRunsPerHour` | 6 | same |
| `ASK_EMBEDDINGS_PROVIDER`, `_REGION`, `_MODEL` | `askEmbeddingsConfig()` | `none` | `none` |
| `ASK_VCFO_MODEL_{GUARD,ANSWER,DOCUMENT,EXTRACT,WATCH,AGENT}` | `askConfig().models` | below | same |
| `WATCH_ALERT_MAILBOX` | `src/lib/watch/mail-intake.ts` | empty, route off | empty |

Models: guard moves to `claude-haiku-5-5` in phase 0 (answer track changes the default, after the live
eval); document, extract and Watch default to `claude-haiku-5-5`; agent to `claude-sonnet-5-5`. A killed
path or an exhausted budget answers with a clear sentence and never fails silently. Every model call on
any path adds to `ask_usage_daily` through `systemRecordAskUsage`, and calls are refused once
`systemTodayTokenTotal` reaches the daily budget.

## Phase 0: measure and cut (answer)

- `provider/index.ts`, `anthropic.ts`, `bedrock.ts`: add `usage.cacheWriteTokens`; `fallbacks` only on
  non-Haiku models; a `refusal` stop reason returns no content.
- `pipeline.ts`: every `finish` records `path` and `cacheWriteTokens`; `Usage` gains the field.
- `guard.ts`: effort low, shortlist (see phase 1), `ROUTER_INTENTS` from `paths.ts`.
- `generate.ts`: sources 8 to 4, history to the rewritten question plus 2 turns, `maxTokens` by depth
  (normal 1,500, detail 2,500; raise if evals show a cut-off). `tools/staff.ts`: model gets the count and
  top 5 rows, the card draws the full list.
- `ask-usage.ts`: `systemRecordAskUsage`, `systemTodayTokenTotal`, `askUsageReport(ctx, range)` (firm-wide
  admin only). Admin page at `app/app/admin/ask-vcfo/usage/`, and `scripts/ask-usage-report.ts`.
- Done: 29 live eval cases pass on Haiku 5.5 with the report written beside `EVAL-LIVE-2026-09-30.md`,
  and tokens per answer are lower.

## Phase 1: facts (answer)

- `metrics/catalog/*.ts` exports `METRICS: MetricDefinition[]`, about 25: `companies.incorporated`,
  `companies.in_progress`, `projects.active`, `projects.waiting_client`, `projects.overdue`,
  `approvals.pending`, `filings.overdue`, `filings.due_soon`, `filings.filed`, `requests.open`,
  `requests.overdue`, `tasks.open`, `tasks.overdue`, `tasks.due_today`, `documents.pending_review`,
  `registrations.in_progress`, `registrations.done`, `clients.total`, `clients.new`, `invoices.outstanding`,
  `invoices.overdue`, `board_meetings.upcoming`, `labour_registers.pending`, `leads.workload`,
  `updates.this_week`. Roles and shells per metric; a client sees only their company.
- `src/db/repositories/ask-metrics.ts`: scoped counts built on `scopeFor(ctx)` and the existing repos.
- `metrics/match.ts` strict alias match plus period words; `local-match.ts` runs metric, topic and greeting
  matches in order. `metrics/periods.ts` reuses `src/lib/compliance/fy-periods.ts`.
- Router shortlist: the metric names for the role plus about 8 topics scored by `retrieve.ts`'s `scoreTopic`.
- Done: "How many companies are incorporated this year?" answers with `path = metric_local`, no model
  call, role-correct for all five roles, in the existing card.

## Phase 2: knowledge (answer)

- `embeddings/{index,bedrock}.ts`: `getEmbeddingProvider()` returns null when `none`. Titan V2, `dimensions: 512`,
  `normalize: true`, on-demand.
- `ingest/extract.ts`: `unpdf` first; only a page with almost no text goes to the model. `run.ts` embeds chunks
  when a provider exists.
- `ask-documents.ts` `searchAskChunks` becomes hybrid: full-text and, with a query vector, cosine; reciprocal
  rank fusion with k = 60; excludes `superseded_at` and future `effective_from`; top 4 to the model.
- `index-cards/*`: builders per source (task, request, note, comment, reg_update) that pass text through
  `maskIdentityNumbers`. `ask-index.ts`: `systemUpsertIndexItems`, `searchIndexItems(ctx, ...)`, which filters
  by `scopeFor` first, then `audience`, then ranks. Event `ask/index.refresh` drives `ask-index-refresh.ts`.
- `question-key.ts` normalises wording; `knowledge-version.ts` hashes the topics version, the latest
  `ask_documents.updated_at` and the latest `reg_updates.published_at`. Saved answers only for document
  answers with no tools called and no personal context.
- Load: `scripts/ask-load-knowledge.ts` loads obligation texts, the statutory calendar and firm notes; report
  what could not be loaded.
- Done: paraphrase and Hinglish eval cases pass with `none` too (full-text) and citations hold; a cross-client
  test proves no card leaks. Live Bedrock is untested unless credentials exist; say so.

## Phase 3: Watch, first release (watch)

- `fetch.ts`: extends `fetchOfficialFeedXml`'s safe-URL and allowlist checks with `If-None-Match`,
  `If-Modified-Since`, a size limit and hash-unchanged stop. User agent keeps the real name and a contact URL.
  `robots.ts` reads and honours robots rules and rate limits per host. A 403, or a robots refusal, sets health
  `blocked` and the source goes to manual intake. No CAPTCHA, no login, no rotated or disguised identity.
- Allowlist adds `sebi.gov.in`, `nfra.gov.in`, `icai.org`, `ibbi.gov.in`, `epfo.gov.in`. `sources-seed.ts` lists
  the sources in the master plan's portal table with type, adapter, area and audience; MCA and Income Tax India
  are `manual`. Feeds every 180 minutes, pages every 720.
- `adapters/<id>.ts`: `SourceAdapter` per source, tested on saved fixtures in `adapters/__fixtures__/`. Page
  fixtures come from a saved copy only; tests never touch the network. Empty list raises health `empty`.
- Pipeline in Inngest: `watch-check.ts` (hourly, picks due sources, returns at once when `askFlags().watch` is
  off) emits `watch/update.process`; `watch-process.ts` steps are read (unpdf, then the model only for scans),
  summarise (`summarise.ts`, `askConfig().models.watch`, strict output schema, no tools, page text wrapped as
  data), verify (`verify.ts`: every date and number in the summary is in `source_text`, the quote matches
  exactly after whitespace folding), merge (same `content_hash` adds a `reg_update_links` row; unsure stays
  separate).
- `announcement-feeds.ts` returns early when Watch is on, so feeds are not posted twice.
- Board visibility: `listAnnouncements` and the head query filter `audience = 'staff'` from clients. An unreviewed
  update has a staff row with `unreviewed = true`. Popups, bell fly-back and the announcement animations stay.
- Review: `app/api/watch/updates/[id]` (`requireAdminOrManager`) edits, publishes, rejects. The queue is at
  `app/app/{admin,manager,super}/watch/`. A failed code check shows `needs_attention` and cannot publish until edited.
- Publish, `publish.ts`, fixed rules in `recipients.ts`: `important` gives one bell row per person at publish;
  `normal` and `staff_only` go to `watch-daily-summary.ts`, with `notified_at` stopping a repeat. Clients only after
  review and never for `staff_only`. Uses `createNotificationsForUsers` through a `system*` repository function.
  Publish also upserts an `ask_index_items` card with `source_kind = 'reg_update'` and `audience = 'both'` (or `staff`).
- Manual intake: `app/api/watch/intake` takes a URL or PDF and enters at the read step.
- Chat: a `updates.this_week` metric and a source-status helper. It says "no updates found from these sources as of
  this date" and never says the law has not changed.
- Health: staff-visible last success per source; `service-checks`-style alert after 3 failures.
- Update `docs/context/notes/notifications.md`, which says pages are not scraped and the bell is work alerts only.
- Done: all pipeline steps tested on fixtures. Live portal checks only if run, and reported as such.

### What Phase 3 built differently, and why

- Adapters sit in one file, `src/lib/watch/adapters/index.ts`, because most share a table shape.
- Importance comes from code (`importanceFor`) and the source's audience. The model's label can lower an update to normal
  but never raise it: a bell to everyone also needs the listed title to name the change, so a hostile page cannot widen
  who is told. A reviewer can still mark an update important.
- A `stale` health was added, because a list that answers with years-old rows otherwise reads as healthy.
- CBIC's `cbic-gst.gov.in` list stopped in December 2022, so the GST lists read are the GST Council's three CGST pages. They lag too (newest rows January to June 2025) and show `Out of date`, so current GST papers need manual intake. `taxinformation.cbic.gov.in` is a manual source: it is script-loaded and its server omits the intermediate TLS certificate, so Node cannot verify it. Whether to read its JSON list is an owner decision.
- `summarise.ts` uses a strict output schema with no tools, as the master plan says, not the single strict tool first written here. On the same 20 live documents output fell from 746 to 329 tokens per document. It added `outputSchema` to the provider exactly as the answer track did, so the merge keeps one copy.
- RBI's PDF host (`rbidocs.rbi.org.in`) answers the reader with a bot check. The notification's own text is read from its page where it has one; a PDF-only paper, such as a Master Direction, fails with the message to upload it.
- A listed title with "draft" or "proposed" is a consultation whatever the model says (`changeTypeFor`), so a proposal never rings every bell.
- The merge runs straight after the read, before the model, because that is the cheapest place for it.
- Watch records its token use through `ask-usage.ts` on the `watch` path since the track merge, so one roll-up and one daily budget cover every path.
- The chat seam is `localUpdates` in `local-match.ts`, after the strict metrics, so "any new clients this month" stays a count. `updatesThisWeekMetric` is the catalog's `updates.this_week`. Both answer on the `metric_local` path with no model call, and the metric maps a filing's law area to Watch's area keys.
- `listRegUpdates` and the review routes keep to `app/api/watch/*`; the page is also at `app/app/intern/watch/`, read-only, since project leads may add an update.
- Publish and reject commit in one transaction with their board row and chat card, so a failure leaves an update waiting and never half published. A rejected update gives up its content hash, so a later copy of the same document is read and not swallowed by that row.
- A scan waits, and does not fail, when the day's budget is spent or no model is configured. A draft the model summarised as made goes to `needs_attention`, because code can correct its label but not its wording. A date on a draft is the comment deadline, so it never shows as a new due date.
- `feed` rows still read "From VCFOSuite" on the board and popup. That is the existing, tested rule, and each row carries its source link and quote.

## Phase 4: paste and file (do)

- `field-catalog/build.ts` builds entries at module load from `CLIENT_RESPONSE_FIELDS`, `compliance-inputs`,
  `compliance-questionnaire`, `registration-rules` and `src/lib/assist-profile/`: canonical key (`director.pan`),
  label, synonyms, format rule, sensitivity, and every step and portal field using it. Sources stay as they are.
- `data-router/`: `read.ts` (documents; `askFlags().idDocReading` gates identity documents; extraction only, strict
  schema, page reference on every value), `formats.ts` (PAN, DIN, CIN, GSTIN, IFSC, PIN), `candidates.ts`
  (catalog search), `choose.ts` (model picks from candidates only; `askConfig().models.extract`), `plan.ts`
  (checks and conflicts). Anything uncertain becomes a question. File text is data and can never authorise an action.
- Rules extraction: the POST body of `app/api/engagements/[id]/checklist/route.ts` moves to
  `src/lib/incorporation/apply-checklist-patch.ts` (`leadWritablePatch`, `stripClientOnlyResponses`, `lastEditedPatch`,
  notify plan). The route calls it, with identical behaviour and tests. Do not rewrite ported domain code.
- Changeset: `changeset/hash.ts` is SHA-256 of canonical JSON (sorted keys) of each row's `action`, `target`,
  `newValue` in ordinal order. `changeset/apply.ts` re-parses, re-checks gates and validators, compares the hash, then
  calls the action's `execute`. `ask-changesets.ts` scopes by `ctx` and engagement; lists and API responses return
  `displayOld` and `displayNew`, never raw sensitive values. Only the person it was prepared for may approve (for a step
  that needs a manager, that manager). The agent has no approve call.
- A step that needs a manager's approval goes to the manager, even from the manager's own run, on the same card.
- UI: `AskComposer` adds files through the existing S3 flow and longer paste (`message` max 20,000);
  `AskChangesetCard` lists step, field, old, new, source page, check; Accept or Edit per row; undo after apply.
- `src/data/ask/schema.ts`: `AnswerEnvelope` gains optional `changesetId` and `runId`.
- Evals: `tests/ask/evals/fill/` with synthetic documents: wrong-field rate, wrong-client rate, injection suite.
- Done: a lead drops synthetic documents, reviews correct proposals, approves, undoes. No wrong-client write.

## Phase 5: do things (do)

- Actions in `tasks`, `requests`, `reminders`, `documents`, `statuses`: the 25 most used, each one with role tests.
  `execute` calls the same repository and rule code as the route, and moved routes call the action.
- `agent/tools.ts`: `actionsForRole(role)`, then `agentMayExecute`, then the `killedTiers` filter; about 10 `common`
  loaded and the rest `defer_loading` with tool search; `strict: true`; `input_examples` where complex.
- `agent/loop.ts`: a manual loop over `LlmProvider.complete` (it keeps the provider switch, and each turn is an Inngest
  step). T0 and T1 run; T2 and T3 create a changeset and pause; T4 is refused. Budget: `askBudgets()`. System prompt
  says tool results and file text are data. `LlmRequest` gains `outputConfig` only as needed.
- `src/jobs/ask-run.ts`: event `ask/run.start`; waits on `ask/changeset.decided` with `step.waitForEvent`. `ask_runs` and
  `ask_run_steps` record everything, masked with `maskIdentityNumbers`. `app/api/ask/runs/[id]` streams progress and
  can be reconnected.
- `do/entry.ts` exports `handleDoWork(ctx, request, message, emit)`. It picks a fixed workflow where one fits, else an
  agent run, locks the run to one engagement (asks if two match), and checks kill switches.
- Done: staff finish daily work from chat, runs survive a page close, and every action has role tests.

## Pipeline seam (answer writes it, do fills it)

Order inside `runAskChat` after phase 2. Each line records the named `path`.

1. Suggestion click: `suggestion`. 2. What's-this: `context`.
3. Kill switch and budget check. Rate limit counts model answers only.
4. `request.attachmentIds` non-empty: go to step 9.
5. `localMatch`: `greeting_local`, `metric_local`, `topic_local`.
6. `findSavedAnswer` on key, audience, language, depth, knowledge version: `saved_answer`.
7. Router on Haiku 5.5. Off-topic and unsafe: `router_refusal`. Greeting likewise.
8. `fact`: metric by name, `router_metric`. Reviewed topic: `router_topic`.
9. `do_work`, staff shell first: `await handleDoWork(...)` (`fixed_workflow` or `agent_run`). In the client shell only after
   phase 7. Until the do track lands, `do/entry.ts` does not exist, so the answer track answers `do_work` with a plain
   "I can't do that from chat yet" line; the do track replaces that one branch.
10. Retrieval, tools, generation: `document_answer` (no tool called) or `tool_answer`.

`chatRequestSchema` gains `attachmentIds: uuid[]`, `page: { path, engagementId? }`, and `message` max 20,000. `AskEvent`
gains `{ type: 'progress'; runId; label }` and `{ type: 'run'; runId; status }`.

## Phase 6: Watch, second release (watch)

- `affected.ts` works out engagements from client data for a due-date change. `calendar-proposal.ts` creates
  `reg_calendar_proposals` rows; a manager approves through `app/api/watch/proposals/[id]`, and only then do the compliance
  instance due dates change through the existing compliance repository. Never automatic.
- Leads see their affected clients on the update. `mail-intake.ts` with `watch-mailbox.ts` feeds alert emails into the read
  step, off while `WATCH_ALERT_MAILBOX` is empty. Sender allowlist; mail text is data.
- Adds second-release sources. Nothing that needs a CAPTCHA or a login.

### What Phase 6 built differently, and why

- `watch-mailbox.ts` was not built. Reading a mailbox needs an IMAP or Graph dependency and AWS wiring that are not allowed tonight, so the mailbox relay posts each raw message to `app/api/watch/mail` instead. Staff also have a paste box. The wiring steps are in `docs/context/notes/notifications.md`.
- Proposals are written at publish, not at the read, so a person has checked the dates first. The review dialog shows a preview from the saved fields. The firm's filing periods decide the rows, and each proposal is for one filing and one period.
- Filings stay where they are in the compliance repository: `moveFilingPeriod` and `systemApprovedCalendarChanges` live in `compliance.ts`, and the generator there reads them. That is an addition to the generator's caller, not a change to `src/lib/compliance/`, whose rules still hold when no date has moved. The move also shifts unsent reminders by the same number of days and writes a line in the filing's history.
- Filing windows and overrides are left alone. An approved move changes the instance due date only.
- An update is matched to rows in order: the old date it gives, then a period the text names, then the nearest earlier date. A year named with no row on the calendar means no proposal.
- Source results on 6 November 2026, from a laptop with the real user agent, one request each: DGFT answered with a plain table of 232 rows, newest 30 October 2026, so it has an adapter. Its CAPTCHA sits only on the separate IEC and MEIS widgets. The PDFs are on `content.dgft.gov.in`, whose `robots.txt` answers 403, so the reader treats each as blocked and it fails with the upload message.
- The rest are manual, with the reason on the health screen: Telangana commercial taxes (`tgct.gov.in`, a post-back list, newest 2021), GST news and GST advisories (script-loaded), ICSI (a thin script shell), DPIIT, Labour and India Code (403 to the reader), eGazette and CBIC tax information (the server omits its TLS intermediate), Finance Ministry (`finmin.gov.in` timed out, and `doe.gov.in` reset its `robots.txt` request).

## Phase 7: whole app (packs)

Three sub-tracks, one folder each, same test bar as phase 5: `compliance` and `registrations`; `board-meetings`, `receivables`
and `labour`; `client-portal`. `client-portal` actions are limited to each client's own fields: `fieldsForOwnership` and the
direct-flow strips from the extracted checklist rule; never another client's engagement; role `client` only. Finalising
resolutions, MCA submit, DSC signing, payments and role changes are T4: define them only if a prepare step helps; they
never execute. Developer routes stay out.

### What the client-portal pack built, and why

A client has their own actions under `client-portal.*`, for role `client` only. The answer pair (`setAnswer`, `attachFile`)
comes from the same factory and the same save as the staff pair, so one rule holds for both. `applyRow` now checks the
action's roles at the click, so a card cannot run an action for a person it was not made for.

- **Own fields only.** Beyond the direct-flow rule, a client's row must be on the form for this kind of company, and a file
  answer must come from a file, so typed text can never point a file field at a stored path. What the firm fills never
  reaches a client's card; the chat says so in a line. The other-step check is off for a client, because it would show a
  value from a step they cannot read.
- **Files find their own place, with no model.** A file goes to the open request, file request or filing its name and the
  message best name. A tie is not guessed: the file goes on to the data router, and the chat lists what is open. Filings
  are looked at only when proof is mentioned.
- **Recipients by name.** A client's card names the firm's people and shows no staff email.
- **The run's company comes from the shell.** The input of an action the model can call has no company, and a name that
  reads as another company stops the run. "For Asha Rao" does not, because that is a person.
- **The message limit went from 2,000 to 20,000 characters** for a client, because a paste now has somewhere to go.
- **Left out on purpose.** A step's approve (a legal sign-off of the firm's work), logins, OTPs and identity numbers.

## Phase 8: portal hand-off (final)

`src/lib/actions/filing/prepare-run.ts`: "prepare filing run" creates a requested `assist_runs` row through the existing
repository, behind `askFlags().assistHandoff`. No MCA login, OTP, DSC PIN or token reaches the model or any Ask table. The
extension fills; a person logs in, signs, pays, submits and records the SRN. Remaining Part B bindings live in
`src/lib/assist-profile/`, and the live portal stays untested until the CS opinion.

## Phase 9: proactive (final)

`src/jobs/ask-proactive.ts`, behind `askFlags().proactive`: scheduled runs with `trigger = 'schedule'` acting as the assigned
person's own `AuthContext`, producing changesets only. T2 and above still wait for that person. An acceptance report per
action from `ask_changeset_rows.status`; autonomy does not rise automatically.

## Contracts in one place

- **Action**: `src/lib/actions/types.ts`. Name `<area>.<verb>`, area folder exports `actions`. `preview` never writes.
- **Tiers**: T0 and T1 run, T2 and T3 need a changeset approval (`needsApproval`), T4 never (`agentMayExecute`).
- **Metric**: `src/lib/ask/metrics/types.ts`. Code writes the answer; `origin: 'deterministic'`.
- **Embedding**: `src/lib/ask/embeddings/types.ts`. 512 dimensions; store `embedding_model` with each vector.
- **Watch**: `src/lib/watch/types.ts`. `regSummarySchema` is the model's output, `SourceAdapter` the source's code.
- **Changeset**: `src/lib/ask/changeset/types.ts`. An API or a prompt only ever sees `displayOld` and `displayNew`.
- **Path**: `src/lib/ask/paths.ts`. Stored on `ask_messages.path` and `ask_usage_daily.path`.
- **Masking**: `maskIdentityNumbers` before anything reaches chat, logs, a stored prompt or `ask_run_steps`.
- **Reviewers**: Watch review and calendar approval use `isAdminOrManager`, no named person.

## Gate for every track

`npm run typecheck`, `npm run test` and `npm run lint` (0 errors). Fresh worktrees need `npm run css:portal` first, because the
client-portal CSS is generated and three test files import it. Commit small, with full-sentence messages; no push, no
deploy, no RDS. Report anything untested, stubbed or not run live in `gaps`.

## Where the answer track left this plan

Phase 0, 6 November:

- The router answers through `output_config.format` (JSON), not a strict tool. A tool definition cost 575 input
  tokens against 441 for the same schema as a format, and the reply fell from about 150 output tokens to about 50.
  Mock providers therefore return the router's reply as a text block.
- Thinking is off on the router, as the phase task asked, at effort low. A probe of the 29 messages at both settings
  showed the same intents and almost the same tokens once the decision wording was tightened, so either would do.
- Generated answers run on Haiku 5.5 at effort low, tool answers included, because the 29 cases passed on it. Raise a
  route with `ASK_VCFO_MODEL_ANSWER`, `ASK_VCFO_MODEL_DOCUMENT` or `ASK_VCFO_ANSWER_EFFORT`.
- `askBudgets()` gains `answerMaxTokens` (`ASK_ANSWER_MAX_TOKENS`, 40,000), because `runMaxTokens` is sized for a Do run
  and could never stop a five-round chat answer.
- The client `getProjectSnapshot` tool is gone. The snapshot is already in the system prompt, and the model spent a
  round on calling the tool anyway. The citation id stays, so stored answers and suggestions keep their label.
- Reviewed topics no longer sit in the fixed prefix; they reach the model through retrieval. No topic is published yet,
  so this saves nothing today, and it stops the prefix growing as topics are published.
- The token report is for a super admin, as the phase task says, not every firm-wide admin. It stays at
  `app/app/admin/ask-vcfo/usage/`, linked from Question gaps and Sources.
- `ROUTER_INTENTS` is live. `do_work` answers with a plain line on `router_refusal`; `fact` runs as a tool answer until
  phase 1 adds the metrics.

Phase 1, 6 November:

- `localMatch` runs before the daily budget and the rate limit, not after them as the seam order says. Those two guard
  model spending, and a number that spends nothing should still be there on the day the budget runs out.
- A strict match means every word of the question is accounted for: a question word, a period, an alias, and at most one
  status, law area or company. Any other leftover word ("why", "penalty") sends the question to the router.
- "This year" means the financial year, and the answer always names the year it counted.
- A client asking `companies.incorporated` gets their company's own date, whatever period was asked, because a count of
  one company in a period reads as a wrong answer.
- The catalog holds 28 metrics: the 25 named above, plus `steps.remaining`, `projects.by_status` and `people.team`,
  which the phase task asked for by subject. `companies.in_progress` reads incorporated state, so a company with the
  certificate step closed but no date set counts as incorporated, while the dated periods of `companies.incorporated`
  need the date.
- `filings.*` use the rows and `filingStatus` of the Filings page. That page shows one financial year at a time, while
  `filings.overdue` counts every year, because a filing missed last year is still overdue. The sentence names how many
  are from an earlier year, and the link opens the page on its full-year view, so 9 in chat next to 8 on the tile reads
  as the same fact. `filings.due_soon` keeps items the page words as Waiting, which its Due soon filter leaves out.
- `invoices.overdue` leaves out disputed invoices and says so in the sentence. `invoices.outstanding` does not.
- `metrics/types.ts` changed from phase 0: `byMonth` became `bars`, which also takes groups, and filters gained
  `fyStartYear` and `client`. A `bars` visual joined the fixed set for code only; it is on neither allowed-visual list, so
  the model cannot emit it. A `list` destination joined the links, with a client subset.
- `useStaffBasePath` sent a Project Lead's Ask links to `/app/manager`. Ask now uses `useAskLinkBase`, and `resolveHref`
  takes the lead's and the client's base.

Phase 2, 6 November:

- Full text matches any word, not every word: `websearch_to_tsquery` ANDs them, so a paraphrase found nothing. Each search
  runs on the words as asked and again on the words `query-expand.ts` adds, so a common added word ("due", "file") cannot
  bury the source holding the rare word the person typed. A full-text hit under a quarter of the best score is dropped,
  and vectors must sit within a cosine distance of 0.8. Both numbers are first estimates; Titan's distances have not been
  seen yet, so look at 0.8 again when Bedrock is switched on.
- The date check now accepts a date held by a document or record source, and `<source>` tags say which kind they are.
  Without this, every answer from the statutory calendar would be rejected. A topic's date still does not count.
- A source is out of the search when it has not begun, has ended or has been replaced. A replacement takes over only when
  it turns ready and its start date arrives, so a failed upload cannot lose the old text. Archiving it restores the old one.
- Record cards hold what people wrote, never a status or an owner, so only text changes refresh them. Staff-only is the
  default: work tasks and notes are staff, requests are both, and a comment reaches a client only if it is not internal
  and the client can see its task. The hooks sit in the repository writes people use. Rows from jobs and scripts
  (`repeat.ts`, board meetings) are picked up by the nightly `ask-index-sweep`.
- Cards join the sources only for a data question, and a card in the sources stops the answer being saved.
- Regulatory update cards stay Watch's: `upsertChatCard` writes them, and a builder here would fight it over the hash.
  `searchIndexItems` leaves out a card whose update a published one replaced.
- Saved answers run after `localMatch` and before the budget, with the same reasoning as phase 1, and only on the first
  message of a conversation. A client's key also holds the company's legal form and residency. A killed `saved_answer`
  path answers in full rather than showing a stop line. Saving clears rows from older knowledge versions.
- `isStandingQuestion` is a word list. It errs towards not saving: "we" and "our" block a saved answer on an otherwise
  general question, which costs a model call and nothing else.
- PDF: `inspectPages` from unpdf tells scans from text. A page under 40 characters with an image on it is a scan; a blank
  page is ignored. Nothing installed can cut a page out of a PDF, so a partly scanned file goes to the model whole with the
  scanned pages named, and input tokens are charged for all of it. Past the daily budget a scan fails with a clear reason
  and a retry works later; a text PDF still indexes, without context prefixes. Ingestion spend is reported under a new
  path, `ingest`. The contextualizer moved to Haiku 5.5 with thinking off, because 200 output tokens would otherwise go on
  thinking. `unpdf` is in `serverExternalPackages`.
- Embedding spend does not reach `ask_usage_daily`, which counts language-model tokens. Titan's cost is small and shows
  on the AWS bill.
- `npm run ask:knowledge:load` loads the playbook, obligation texts, statutory calendar, glossary, reviewed topics and the
  two overview PDFs (staff only, read first: they name roles, not people). No topic is published yet, so none loaded. A
  topic restricted by legal form or residency stays with the topic code, because a search source has no per-viewer check.
  The dark copy of the map PDF is the same text and is left out.
- `npm run eval:knowledge` is the database eval (40 cases against pgvector with a fake embedding provider), and
  `npm run eval:knowledge:live` runs the paraphrase and Hinglish cases through the real pipeline.

## Where the do track left this plan

Phase 4, 6 November:

- The field catalog is written by `npm run ask:catalog` into a checked-in `catalog.generated.json`, and a test fails when
  it is stale. The plan said module load. A generated file costs nothing at start-up and shows every change in review.
  `src/lib/assist-profile/` is not a source yet, because phase 4 covers incorporation steps only.
- `AskRunProgress` and a runs route were not built. `progress` events reuse the chat's existing status line, and `run`
  events are sent and ignored until phase 5 has a run worth showing. Changeset `messageId` stays empty, because the card
  is found through its conversation.
- `AnswerEnvelope.origin` gains `work`. A line about work in progress has no content to vouch for, and "Reviewed by SBC"
  over values read from an unchecked document would be false. `TrustBadge` shows nothing for it.
- `message` is 20,000 for staff and stays 2,000 for a client, through a refine on the schema. The stored copy of a long
  paste is capped at 1,000 characters and masked. A paste goes to S3 only when the run has to wait for a reply.
- A locked step holds its row, which is stricter than the lead's screen, as the worked example asks. A finished or
  waiting step holds too. An equal saved value drops the row rather than showing a change that is not one.
- Rows run as the person who clicks, so a manager's approval is audited as the manager. A manager or firm admin can open
  a card only when it holds a row for them; other cards answer "not available" even on their own engagement.
- A manager accepting a real approval step is covered by unit tests with `needsManager` rows. The browser test only
  opens such a card from its link.

Phase 5, 6 November:

- Only the loaded common tools are `strict`. The API refuses more than 20 strict tools in one request and counts deferred
  ones: "Too many strict tools (27)". Zod parses every input again at execution, so a deferred tool loses nothing.
- A fixed workflow is offered only for an action marked `simple` that needs no item id: `tasks.create`,
  `requests.create` and `notes.add`. Everything else goes to the agent run, because finding the item is the open-ended part.
- Work asked for in words costs one Haiku pick, because a sentence names no action in a form code can read, and a wrong
  workflow costs more than the pick. A file or a labelled paste goes straight to the data router and skips it.
- The pick can answer `fill_details`, which goes to the data router, and `open_ended`, which starts the agent run.
  `checklist.setResponse` and `checklist.attachFile` are marked `routerOnly` and are not agent tools, so step values
  still reach a card through the router's checks and nowhere else.
- A `notes` area was added, as the 25 needed it: `notes.list`, `notes.add`, `notes.delete`.
- "Most used" was counted from the `fetch` call sites in the app, as a proxy. Real usage is on RDS, which this track may
  not read.
- Only `app/api/requests` held a rule the chat must also obey, so only it was extracted, into
  `src/lib/requests/create-document-request.ts`. Every other route's rules were already in its repository, and those
  routes were left as they are, so they do not call the action.
- Rejecting a changeset now marks its open rows skipped, so an agent run reads a clear result when it wakes.
- The envelope gains `runLive`, which tells the thread to follow a run, and a changeset summary gains `hasUndo`, so the
  card offers undo only for actions that have it.
- The loop's live checks go through vitest and the browser test, because a script under `--conditions=react-server`
  cannot load the registry.


## Where the ops pack left this plan

Phase 7 pack for board meetings, receivables and labour registers, 6 November: 41 actions, in
`src/lib/actions/{board-meetings,receivables,labour}/`.

- A receivables sheet is on no project, so its actions are marked `firmWide`. A request for one skips the client lock:
  `pick.ts` offers a `receivables_work` way out, `work.ts` takes no lock, and a run with no lock sees only firm-wide
  tools. The repository's scope, the sheet's own manager and the firm-wide admins, is the guard, and the sheet's change
  log is the audit. A card with no project stays with the person who made it. A locked run can still reach these tools,
  and a card mixing the two carries the project. This went beyond the pack's folders, as the smallest seam the ownership
  rule allows, because the chat could not otherwise reach a sheet: `types.ts`, `work.ts`, `pick.ts`, `loop.ts` and one
  sentence in `guard.ts`.
- No payment action exists. `markReceived` and `decideCredit` record money that already arrived, and the card says so.
  A live run on Haiku refused "mark this paid" until `markReceived` became `simple`; it now reaches the card, and "pay the
  vendor invoice" and "transfer" still get no action. A live run on Sonnet refused to pay an invoice or finalise a
  resolution, with no tool and no card.
- Code names every recipient. An invoice's partner, a resolution's signers (all current directors) and a meeting's
  recipients are not in any input. `sendSummary` takes a ready-made list only, and its card stores who was on the list, so
  a card accepted days later refuses if the list has changed. `publish`, `sendRemindersNow` and `replyToPartner` do the
  same: preview fills `cardCheck`, overwriting anything the model sends, and execute compares it with what is true now.
- `labour.markReady` is T3, and accepting the card is the person's own statement of accuracy. It enforces `canClose` from
  the same readiness check the batch screen uses, which the route leaves to the screen's dialog.
- `simple` went only to `board-meetings.create`, `labour.openBatch` and `receivables.markReceived`. The last takes an
  invoice number, finds the one open invoice with it across the person's sheets, and defaults the amount to what is open
  less TDS; a part payment or a foreign invoice with no amount is asked for the rupees. `labour.openBatch` uses the
  project's one existing state when none is named. None of the pack is `common`, to stay inside the strict-tool limit.
- The router sent staff questions about these records to `ops_query`, whose tools cannot read them, so the read actions
  were out of reach. A sentence in the staff audience now routes them to work. It is staff only, so a client's chat routes
  as before.
- Live runs first missed "skip today's reminder" and "send back the board meeting notice", which proposed a stage change
  and a note, because the model never searched. `SYSTEM` in `loop.ts` and `OPEN_ENDED` in `pick.ts` now name these areas,
  and both requests reach the right card.
- `tests/ask/evals/ops-cards.test.ts` puts every write action on a real card on Postgres, on a local `*_eval` copy with
  everything outward stubbed, and fails if one is missed. With `ASK_EVAL_LIVE` it runs the router, the pick and the loop,
  accepts each card and lets the run finish.
- Each area turns repository codes into sentences locally, because `REFUSAL_COPY` in `shared.ts` is outside the pack.
- The routes for approve, cancel and remind on a meeting, send for signature, receipts, partner replies, the reminder
  desk, send now, the summary, assumptions and generate now call shared functions in these folders.
- Left out on purpose: uploads that need a file (minutes, signed copies, bank statements, FIRAs, labour uploads and
  mapping), director records (identity numbers, DIR-12), share links and partner logins (tokens and credentials), adding
  or editing partners (recipient choice), reminder rules and sheet settings, the treasury desk (forwards, alerts, rates),
  attestation (a signed statutory record), the firm's verification and code-rule decisions, downloads and exports, and
  developer routes.

## Where the pack merge left this plan

- `chatbot-pack-compliance`, `chatbot-pack-ops` and `chatbot-pack-client` are merged with merge commits. No pack added a
  migration, so the journal still ends at `0047_ask_foundation` with 48 unique entries, `drizzle-kit generate` finds no
  schema change, and `vcfo_chatbot` has all 48 applied.
- Three conflicts needed a person's reading. `SYSTEM` in `agent/loop.ts` now names staff, clients and firm-wide runs, and
  says the other tools exist only where this person may use them. `do/work.ts` keeps the firm-wide skip and passes
  `ownCompany` to the lock. The notes keep both sides.
- `actions/registry.test.ts` pins the count of each area and checks that every area folder and every written action name is
  registered. `agent/tools.test.ts` pins what each role sees, area by area, the lead-only and intern-only names, and that
  only receivables are firm-wide.

## Where the final track left this plan

Phase 8, portal hand-off:

- `filing.prepareRun` needs both `ASK_ASSIST_HANDOFF_ENABLED` and `VCFO_ASSIST_ENABLED`, because the assist-runs route has
  that rule too. With either off the action is not in the tool list, and a card made earlier is refused at the click.
- It is T2, and it only stores a `requested` row through `requestAssistRun`. Code works out the form from the item, so the
  model cannot name one. Filed, not needed and done items, and items with an open run, are refused. Undo works only while
  the run is still `requested`.
- The input uses plain `z.object`, not `.strict()`, because a row's input at the click also holds `value`. Plain strips
  extras, so a credential field sent to the action is dropped, and a test holds that.
- A message holding a portal login, OTP, DSC PIN or token now stops in the pipeline before any model
  (`holdsPortalSecret`), and the same values read `[hidden]` wherever text is masked.
- Not done: the remaining Part B field bindings and a live portal run depend on the other session's uncommitted filing work
  and on the CS opinion. Nothing here touched the MCA portal.

Phase 9, proactive:

- The job calls no model. Code finds the work, so a quiet night costs nothing and a page's text cannot suggest anything.
  It does read the same limits: the flag, `fixed_workflow` and T2 in the kill switches, and the daily budget.
- Each project has one owner: its lead, or its manager when there is no active lead. Managers of a project are also listed
  with no projects of their own, because a due date change waits on a manager. Several managers may each get that card,
  and the first to accept decides it.
- Tonight's proposals are overdue requests and overdue filings waiting on the client (`reminders.sendClient`), files on a
  step unreviewed for two days (`documents.review`, with a note on the row to open the file first), and due date changes
  waiting on Watch (`compliance.approveCalendarChange`, new, T2, router-only).
- One card per project and one per owner for firm-wide work, ten rows a card and ten cards a night, one bell row linking to
  all of them. A row proposed once stays quiet for 14 days, whatever became of it, so a retried step cannot double a card.
- Turning down a due date card leaves the change waiting on the Watch screen, because an unused card is not a decision.
- Migration `0050_ask_row_edited` (renumbered after main's `0048_budgets` and `0049_budget_variance`, 9 November) adds `ask_changeset_rows.edited_at`, because "accepted without an edit" cannot be
  measured from the row's status. The token page and `scripts/ask-usage-report.ts` show cards per action, chat and
  overnight apart. Nothing reads those numbers to act.
- `src/lib/ask/proactive/no-auto-apply.test.ts` reads the source to prove no job, no agent code and no proactive code can reach
  the code that applies a card. `prepare.test.ts` watches every action's `execute` and `undo` while the job runs.
- `e2e/ask-proactive.spec.ts` needs a local Inngest dev server, and its header says how to start one. The server must be up
  first, because Playwright's own `webServer` runs `predev`, which starts Docker for the main checkout's containers.
