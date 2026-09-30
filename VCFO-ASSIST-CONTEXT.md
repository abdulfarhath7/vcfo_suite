# VCFO Assist — build context for Claude Code

Version 1.0 · 2026-09-30 · Owner: product owner (VCFO Suite)
Companion to `CLAUDE-CONTEXT.md`. Read that first; everything there still holds. This file specifies one feature: **VCFO Assist**, the in-app assistant for the client, admin and super admin portals.

Design reference: Claude Design canvas "VCFO Assist chatbot UI" (4 artboards: Client inbox with Assist, Client library, Admin home with Assist, Super admin overview with Assist). The canvas is a visual reference only. Where this file and the canvas differ, **this file wins** (it includes the post-review improvements D1–D5).

---

## 0. Read this first

### 0.1 What Assist is

A slide-over assistant inside VCFO Suite that:

1. **Teaches clients.** Clients (often foreign parent executives) do not know what incorporation, SPICe+ Part A, GST, FC-GPR or DSC mean. They ask anything and get a **short, visual, plain-English explanation** tied to their own project, and can **save it to their own library**.
2. **Answers firm operations questions for admins and super admins.** "Which projects are waiting on clients?", "What is overdue?", "What approvals are pending?", plus rule lookups with citations.
3. **Refuses everything else.** No programming help, no stock tips, no general chat, no decisions on the firm's behalf.

### 0.2 Who gets it

| Code role | UI label | Assist | Persona | Data scope |
|---|---|---|---|---|
| `client` | Client | Yes | Teacher | Own engagement(s) only |
| `admin` | Firm Admin | Yes | Operations assistant | Firm-wide |
| `super_admin` | Super Admin | Yes | Operations assistant; client persona inside a client shell | Firm-wide; one engagement when previewing a client |
| `manager` | Project Manager | **No** | — | API returns 403 |
| `intern` | Project Lead | **No** | — | API returns 403 |

Never show the word "intern" anywhere in UI, prompts that reach users, or answers.

### 0.3 Hard rules (apply to every phase)

1. **Repository seam is sacred.** Only `src/db/repositories/*` imports `db`. Assist tools call repositories with `AuthContext`. The model never sees SQL and never receives rows outside the caller's scope.
2. **Assist is read-only.** It never sends email, never changes checklist state, never approves, never uploads. The only write it performs on the user's behalf is creating a request to the lead (explicit button press) and saving a library item.
3. **Never show board resolution drafts to clients.** BR content is visible to a client only after `status=finalized`. Tools enforce this in the repository, not in the prompt.
4. **Never invent steps, forms or rules.** Step names and ids come from `src/data/checklist.ts`. Do not edit `checklist.ts`, per-step validators, docx generators, gate logic (`src/lib/checklist-step-gate.ts`) or compliance math.
5. **Due dates come only from the compliance calendar and checklist data**, never from model text or knowledge-base prose. Validation enforces this (§6.6).
6. **The bot explains; the firm decides.** Any request for a decision ("do we need GST?", "should we choose LLP?", "can we skip X?") gets an explanation plus a hand-off to the lead. Never a yes/no on the firm's behalf.
7. **No secrets in the client bundle.** Anthropic/AWS credentials are server-only (`import "server-only"`), loaded from Secrets Manager under `/vcfo/assist/*` in AWS and from `.env.local` locally.
8. **No Supabase. No new vendors without a confirm checkpoint.**
9. **DPDP:** no cross-region replication; never send PAN, passport, Aadhaar, DIN, bank account numbers or addresses to the model. Snapshots carry only the fields listed in §6.3.
10. **Tokens, not hex.** All UI uses existing CSS variables / Tailwind tokens from `app/globals.css` and `tailwind.config.ts`. Must work in light and dark mode.
11. **Status colour on chips and icons only**, never as page fill. Waiting = coral, done = teal-green, overdue = rose, locked = slate.

### 0.4 Open decisions (defaults chosen so the build is not blocked)

| # | Decision | Default in this build | Why the default is safe |
|---|---|---|---|
| OD1 | Anthropic API direct vs Claude via Amazon Bedrock | Provider interface with both adapters; `ASSIST_LLM_PROVIDER=anthropic` by default | Switching is one env var; no migration |
| OD2 | Embeddings provider for vector search | **None in v1.** Retrieval uses Postgres full-text search. `embedding` column is nullable and unused until chosen | Adding vectors later is additive |
| OD3 | Reranker | None in v1 | Reviewed topics cover most traffic |
| OD4 | Library placement | Own client nav item "Library" (as on the canvas) | Moving it into Documents later is a route change only |
| OD5 | PDF export library | Use existing PDF/doc tooling if Phase 0 finds one; otherwise **pause at checkpoint** before adding a dependency | Respects "no new dependency without confirm" |

---

## 1. Improvements folded into this build (from design review)

Every item below is part of this spec. "v1" items are built now; "later" items are designed for but not built.

| Id | Improvement | Phase | v1 / later |
|---|---|---|---|
| T1 | Pre-kept questions and starter topics are **pre-written, firm-reviewed content**, served without calling Claude | 1, 3 | v1 |
| T2 | Every call carries a **project snapshot** (legal form, residency, current step, phase) so answers fit the company type | 3 | v1 |
| T3 | Answers are produced through a **tool call with a strict JSON schema**; invalid output falls back to text | 3 | v1 |
| T4 | Answer in the **user's language**; UI chrome stays English | 3 | v1 |
| T5 | When Assist can't answer, it **pre-fills "Ask my lead"** with the question and conversation attached | 3, 5 | v1 |
| D1 | **Less blue**: user bubble is neutral; only Send is solid primary | 4 | v1 |
| D2 | Panel is 400 px; **pushes** content at ≥1440 px viewport, **overlays** below that | 4 | v1 |
| D3 | **Expand** an explainer into a full-page reader view | 5 | v1 |
| D4 | Full **dark mode** for panel, answers and visuals | 4 | v1 |
| D5 | **Mobile bottom sheet** with horizontal suggestion chips | 4 | v1 |
| F1 | **"What's this?"** on steps, form fields and compliance items opens Assist with context | 5 | v1 |
| F2 | **Glossary terms**: known jargon is underlined; hover/tap shows one line and "Explain more" | 5 | v1 |
| F3 | Library **export as a branded PDF brief** for the parent company | 5 | v1 |
| F4 | First-week **learning path** ("Your India setup in 5 minutes") | — | later |
| F5 | Admin questions the dashboard can't answer (e.g. clients inactive 7+ days) | — | later |
| U1 | **Trust badges**: "Reviewed by {firm}" on reviewed answers; "AI answer · check with your lead" on generated ones | 4 | v1 |
| U2 | **Progress labels** while waiting ("Checking your project…", "Finding sources…", "Writing…") | 3, 4 | v1 |
| U3 | Panel **keeps state** across navigation; reopening resumes | 4 | v1 |
| U4 | **⌘J / Ctrl+J** opens and closes; **Esc** closes | 4 | v1 |
| U5 | Every visual has a **text equivalent** for screen readers | 4 | v1 |
| R1 | **Decision requests route to the lead** (guard intent `decision_request`) | 3 | v1 |

---

## 2. Architecture

```
Browser (client / admin / super shell)
  └─ AssistPanel ──fetch/stream──▶ app/api/assist/* (Next.js route handlers, server-only)
                                     │
                                     ├─ auth + role gate (403 manager/intern) + rate limit
                                     ├─ resolve suggestion? ──▶ deterministic handler (NO model call)
                                     │        ├─ topic  → src/data/assist/topics/*.json
                                     │        └─ query  → repository tool + template
                                     ├─ guard (Haiku): intent, rewrite, language
                                     │        ├─ off_topic / unsafe → fixed refusal
                                     │        └─ decision_request  → explain + hand-off
                                     ├─ project snapshot (repositories, AuthContext)
                                     ├─ reviewed topic match? → serve topic (no Sonnet)
                                     ├─ retrieval: Postgres FTS over assist_chunks (+ topics)
                                     ├─ tools: read-only repository calls
                                     ├─ generate (Sonnet) via render_answer tool (JSON schema)
                                     ├─ validate (code): citations, dates, BR, schema
                                     └─ persist assist_messages (+ usage, latency)

Offline (Inngest): admin uploads source → chunk → contextualize (Haiku) → index (tsvector)
```

Request types, cheapest first:

1. **Suggestion click** → deterministic. No model call. (T1)
2. **Free text that matches a reviewed topic** (guard returns a confident `topicSlug`) → serve the reviewed topic. Guard call only.
3. **Free text needing live data or retrieval** → full pipeline with Sonnet.

---

## 3. Content model (reviewed answers)

Reviewed content lives in the repo, like `checklist.ts`: versioned, reviewed through pull requests, validated by tests.

### 3.1 Files

```
src/data/assist/
  topics/            one JSON file per topic, e.g. spice-plus-part-a.json
  glossary.ts        term list for underline + hover cards
  suggestions.ts     pre-kept questions per shell
  playbook.md        compact firm playbook placed in the cached system prompt
  schema.ts          zod schemas for topics, answers, visuals (single source of truth)
```

### 3.2 Topic schema (`schema.ts`)

```ts
Topic = {
  slug: string;                      // kebab-case, unique
  title: string;                     // "SPICe+ Part A"
  question: string;                  // "What is SPICe+ Part A?"
  category: "incorporation" | "tax" | "foreign-investment" | "labour" | "compliance" | "your-project";
  audience: "client" | "staff" | "both";
  appliesTo: {
    legalForms: Array<"company" | "llp" | "partnership" | "proprietorship">; // [] = all
    residency: Array<"domestic" | "foreign">;                                 // [] = both
  };
  alternateFor?: { legalForms: string[]; slug: string }[]; // e.g. SPICe+ for LLP → "fillip-llp-incorporation"
  stepIds?: string[];                // checklist ids this topic explains (for F1 and next-step)
  body: {
    normal: string;                  // 1–3 sentences, plain English
    simple: string;                  // 1–2 sentences, no jargon
    detail: string;                  // up to ~6 sentences
    why: string;                     // "Why it matters to you", 1–2 sentences
  };
  visual?: Visual;                   // see §3.3
  citations: { id: string; label: string; url?: string }[]; // at least 1
  related: string[];                 // topic slugs, max 3
  status: "draft" | "published";     // only "published" is served as Reviewed
  version: number;                   // bump on every content change
  reviewedBy?: string;               // reviewer name/role, required when published
  reviewedAt?: string;               // ISO date, required when published
}
```

Rules enforced by tests:

- Every `published` topic has `reviewedBy`, `reviewedAt` and ≥1 citation.
- Every `stepIds` entry exists in `src/data/checklist.ts` (active catalog; `reg-2` is legacy-only and must not appear).
- Every `related` slug exists.
- **Every client-owned step in the active catalog has at least one topic** (draft is acceptable in v1; the test lists missing ones).
- `body.normal` ≤ 400 characters; `body.simple` ≤ 250.

**Draft content is never shown with the "Reviewed" badge.** Draft topics may be used as retrieval context for generated answers only, and the answer is then badged "AI answer".

### 3.3 Visual schema (fixed component set)

The model and topics may only emit these shapes. Anything else is rejected by zod and the answer renders as text only.

```ts
Visual =
 | { type: "flow";      stages: { label: string; sub?: string; state: "done" | "here" | "next" }[] }   // 2–5 stages
 | { type: "steps";     items: { label: string; form?: string }[] }                                     // 2–8 items
 | { type: "compare";   left: { title: string; points: string[] }; right: { title: string; points: string[] } } // ≤5 points each
 | { type: "timeline";  events: { label: string; when: string; source: "calendar" | "rule" }[] }       // 2–6 events
 | { type: "keyFacts";  facts: { k: string; v: string }[] }                                              // 2–6 facts
 | { type: "nextStep";  stepId: string; title: string; dueLabel?: string; items: string[] }             // client only
 | { type: "projectRows"; rows: { engagementId: string; name: string; step: string; meta: string; tone: "late" | "waiting" | "plain" }[] } // staff only
 | { type: "metrics";   items: { k: string; v: string }[] }                                              // staff only, 2–4
```

`flow.state` for a client is computed from the snapshot at render time when the topic declares `stepIds`, so "You are here" is always true for this client.

### 3.4 Starter content for v1

Seed these as `status: "draft"` (they must be reviewed by the firm before publishing). The text used on the canvas is a starting point, not approved copy.

| Slug | Question | Visual |
|---|---|---|
| `spice-plus-part-a` | What is SPICe+ Part A? | flow |
| `gst-basics` | What is GST, and do we need it? | keyFacts (answer defers the "do we need it" decision to the lead) |
| `after-incorporation` | What happens after incorporation? | steps (bank, capital, SH-1, INC-20A, ADT-1, FC-GPR) |
| `director-kyc` | What is Director KYC? (step topic) | nextStep |
| `fc-gpr` | What is FC-GPR? | keyFacts |
| `fillip-llp-incorporation` | How is an LLP incorporated? | flow (alternate for SPICe+ when legal form is LLP) |

Then one topic per client-owned catalog step (P1 corpus work, written outside Claude Code and added by PR).

### 3.5 Suggestions (`suggestions.ts`)

```ts
Suggestion = {
  id: string;
  shell: "client" | "admin" | "super";
  group: string;                           // "About your project" | "Learn the basics" | "Your firm today" | "Rules and forms"
  label: string;                           // the question text shown
  handler:
    | { kind: "topic"; slug: string }                    // reviewed content
    | { kind: "nextStep" }                               // client: current step topic + nextStep visual
    | { kind: "query"; query: "waitingOnClient" | "overdueAndDueSoon" | "pendingApprovals" | "firmPulse" | "atRisk" }
    | { kind: "previewClient" };                         // super only
  appliesTo?: Topic["appliesTo"];                       // hide if not applicable to this client
}
```

v1 suggestions:

- **Client:** What is my next step? (`nextStep`) · What is SPICe+ Part A? · What is GST, and do we need it? · What happens after incorporation?
  - LLP client: SPICe+ suggestion is replaced by "How is an LLP incorporated?" (T2).
  - Domestic client: hide FC-GPR-related suggestions.
- **Admin:** Which projects are waiting on clients? · What is overdue or due this week? · What approvals are pending? · Explain FC-GPR in simple words
- **Super admin:** How is the firm doing this week? · Which projects are at risk? · Preview Assist as a client · Explain FC-GPR in simple words

---

## 4. Data model (new tables)

Each table: Drizzle schema in `src/db/schema/*` (follow existing layout), a repository in `src/db/repositories/assist-*.ts` taking `AuthContext`, and a cross-tenant test.

### 4.1 `assist_conversations`
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| profile_id | fk profiles | owner |
| role | text | role at creation |
| shell | text | `client` \| `admin` \| `super` |
| engagement_id | fk engagements, nullable | set for client shell (and super previewing a client) |
| created_at, last_message_at | timestamptz | |

### 4.2 `assist_messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| conversation_id | fk | |
| sender | text | `user` \| `assistant` |
| text | text | user text, or answer `line` |
| answer | jsonb, nullable | full `AnswerEnvelope` (§6.5) |
| origin | text, nullable | `reviewed` \| `generated` \| `deterministic` \| `refusal` |
| guard | jsonb, nullable | guard output |
| retrieved_chunk_ids | uuid[] | |
| tool_calls | jsonb | names + arguments (no raw rows) |
| model, input_tokens, output_tokens, cache_read_tokens, latency_ms | | usage accounting |
| created_at | timestamptz | |

### 4.3 `client_library_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| profile_id | fk profiles | private to this user in v1 |
| engagement_id | fk engagements | |
| topic_slug | text, nullable | set when saved from a reviewed topic |
| message_id | fk assist_messages, nullable | set when saved from a generated answer |
| title, category | text | |
| snapshot | jsonb | `AnswerEnvelope` as saved |
| source_version | int, nullable | topic version at save time |
| shared_with_team | boolean default false | column exists; UI toggle is **later** |
| created_at | timestamptz | |

"Updated" badge = `topic_slug` set and current topic `version` > `source_version`. Opening shows the current version and a line "Updated since you saved it".

### 4.4 `assist_documents` and `assist_chunks` (knowledge ingestion)
`assist_documents`: id, title, source_type (`govt` \| `firm_pdf` \| `firm_note`), source_url, s3_key, effective_from, last_verified_at, owner_profile_id, status (`processing` \| `ready` \| `failed` \| `archived`), audience (`client` \| `staff` \| `both`), created_at.

`assist_chunks`: id, document_id, ordinal, text, context_prefix (Haiku-written, 50–100 tokens), tsv (`tsvector` generated from context_prefix + text), embedding (`vector`, **nullable, unused in v1**), created_at. GIN index on tsv.

If Phase 0 finds the pgvector extension unavailable, omit the `embedding` column in v1 and note it; do not block.

### 4.5 Not new
"Ask my lead" reuses the **existing requests** mechanism (Phase 0 confirms the table and repository name). Do not create a parallel requests table.

---

## 5. API routes

All under `app/api/assist/`. Every route: `requireAuth` → role gate → `AuthContext` → repositories. Follow the existing `require[A-Z]…` guard naming.

| Route | Method | Roles | Purpose |
|---|---|---|---|
| `/api/assist/suggestions?shell=&engagementId=` | GET | client, admin, super | Suggestions filtered by role and snapshot |
| `/api/assist/topics/[slug]?depth=&engagementId=` | GET | client, admin, super | Reviewed topic as `AnswerEnvelope`, no model call |
| `/api/assist/glossary` | GET | client, admin, super | Terms for underline (cached, ETag) |
| `/api/assist/chat` | POST (streaming) | client, admin, super | Main pipeline (§6) |
| `/api/assist/conversations/[id]` | GET | owner only | Resume conversation (U3) |
| `/api/assist/library` | GET, POST | client (and super previewing: read-only) | List / save |
| `/api/assist/library/[id]` | GET, DELETE | owner | Read (with update check) / remove |
| `/api/assist/library/[id]/export` | GET | owner | PDF brief (F3) |
| `/api/assist/library/export?ids=` | GET | owner | Multi-item PDF brief (F3) |
| `/api/assist/handoff` | POST | client | Create request to lead with question + conversation link (T5) |
| `/api/assist/admin/documents` | GET, POST | admin, super | Upload/list knowledge sources (Phase 7) |

Role gate: `manager` and `intern` → **403** on every Assist route. Tests cover both.

`POST /api/assist/chat` request:

```ts
{
  conversationId?: string;
  shell: "client" | "admin" | "super";
  engagementId?: string;            // required for client shell
  message?: string;                 // free text
  suggestionId?: string;            // pre-kept question (T1 path)
  context?: { kind: "step" | "field" | "compliance"; ref: string; label: string }; // F1
  depth?: "normal" | "simple" | "detail";
  language?: string;                // optional override; default detected by guard (T4)
}
```

Response: a stream of newline-delimited JSON events:

```ts
{ type: "status", label: "Checking your project…" | "Finding sources…" | "Writing…" }  // U2
{ type: "answer", conversationId, messageId, answer: AnswerEnvelope }                 // exactly one
{ type: "error", code: "rate_limited" | "unavailable" | "forbidden", message: string }
```

Super admin in a client shell: `shell="client"` with an `engagementId`; the server verifies the caller is `super_admin` and uses the **client persona and client tool set scoped to that one engagement**.

---

## 6. Server pipeline (`src/lib/assist/`)

```
src/lib/assist/
  provider/            index.ts (interface), anthropic.ts, bedrock.ts
  guard.ts             intent + rewrite + language (Haiku)
  snapshot.ts          project snapshot builder (repositories)
  suggestions.ts       resolve suggestion → deterministic answer
  topics.ts            load/validate topics, applicability, alternates, depth
  retrieve.ts          Postgres FTS over assist_chunks + draft topics
  tools/               client.ts, staff.ts (tool schemas + repository calls)
  generate.ts          prompt assembly, caching, render_answer tool
  validate.ts          schema, citations, dates, BR, scope checks
  refusals.ts          fixed copy for refusal / decision hand-off / unavailable
  rate-limit.ts        Postgres-count based limiter
  pipeline.ts          orchestration + status events + persistence
```

### 6.1 Provider interface (OD1)

```ts
interface LlmProvider {
  complete(req: { model: string; system: SystemBlock[]; messages: Msg[]; tools?: ToolDef[];
                  toolChoice?: ToolChoice; maxTokens: number }): Promise<LlmResult>;
}
```

- `anthropic.ts`: official Anthropic TypeScript SDK, Messages API, prompt caching on the system blocks.
- `bedrock.ts`: Anthropic Bedrock SDK with the same Messages shape; region from env.
- Selected by `ASSIST_LLM_PROVIDER`. Model ids come from env only (§10). No model id is hardcoded in logic.

### 6.2 Guard (Haiku)

Input: rewritten last 4 turns + current message + shell. Output (JSON, validated):

```ts
{
  intent: "explain" | "project_status" | "ops_query" | "decision_request" | "greeting" | "off_topic" | "unsafe";
  rewrittenQuery: string;           // standalone query
  topicSlug?: string;               // only if confident match to an existing topic slug (list provided)
  language: string;                 // BCP-47 of the user's message (T4)
}
```

Routing:

- `off_topic` / `unsafe` → `refusals.offTopic(shell)`; no further calls.
- `greeting` → short fixed reply + suggestions.
- `decision_request` (R1) → explain the underlying topic (reviewed if available) **and** attach the hand-off action with copy "This is a decision for your firm. Your project lead can confirm it for your company." For admin/super, decisions are still not made by Assist; it points to the relevant project.
- `explain` with `topicSlug` of a published, applicable topic → serve topic (no Sonnet).
- Otherwise → full generation.

In-scope definition (give this to the guard verbatim in its prompt): Indian company setup and ongoing corporate compliance: company law and MCA filings, LLP incorporation, GST, TDS and corporate income tax basics, FEMA and RBI reporting for foreign investment, labour registrations (PF, ESI, Professional Tax, Shops and Establishments), import/export codes, trademarks, and anything about the user's own VCFO Suite project. Out of scope: programming, personal finance and investing, other countries' law, general knowledge, opinions, and anything unrelated to the project.

### 6.3 Project snapshot (T2)

Built from repositories for the caller's engagement. Only these fields may reach the model:

```ts
{
  companyName: string;
  legalForm: "company" | "llp" | "partnership" | "proprietorship";
  residency: "domestic" | "foreign";
  hasForeignParent: boolean;
  currentPhase: "SPICe+ Part A" | "SPICe+ Part B" | "Post-incorporation" | "Registration" | "Compliance";
  currentStep: { id: string; title: string; owner: "client" | "lead"; status: string; dueLabel?: string } | null;
  completedStepCount: number; totalActiveSteps: number;
  incorporated: boolean;             // COI issued
  upcomingCompliances?: { name: string; dueDate: string }[]; // next 30 days, from calendar
}
```

Never include: PAN, TAN, CIN digits, DIN, passport/Aadhaar numbers, addresses, bank details, director names, email addresses. The "Operational Readiness" stage stays filtered out as in the main UX.

### 6.4 Tools (read-only)

Client (scoped to the snapshot's engagement):

| Tool | Returns |
|---|---|
| `getProjectSnapshot` | §6.3 |
| `getStepExplainerContext(stepId)` | step title, owner, status, whether locked and what unlocks it ("opens after {title} is complete"), linked topic slug |
| `getUpcomingCompliances(days ≤ 90)` | name, due date, status, from compliance calendar |

Admin / super (firm-wide; super also allowed per-engagement in preview):

| Tool | Returns |
|---|---|
| `listWaitingOnClient()` | engagementId, company, step title, days waiting |
| `listOverdueAndDueSoon(days ≤ 30)` | engagementId, company, item, due date, overdue flag |
| `listPendingApprovals()` | engagementId, company, step title, days waiting |
| `getProjectSummary(engagementId \| companyName)` | phase, current step, blockers, counts |
| `getFirmPulse()` | active, waiting on clients, pending approvals, overdue counts |

Every tool: implemented in `src/lib/assist/tools/*`, calls repositories with the caller's `AuthContext`, returns minimal fields, and has a test proving a client cannot read another engagement and a client cannot receive a non-finalized BR.

### 6.5 Generation (Sonnet) and the `render_answer` tool (T3)

- System prompt = [persona block for shell] + [rules block] + [cached `playbook.md` + published topic summaries] (prompt-cached) + [snapshot] + [retrieved chunks with ids].
- `tool_choice` forces `render_answer`, whose input schema is `AnswerEnvelope`:

```ts
AnswerEnvelope = {
  line: string;                              // plain-English answer, in user's language (T4)
  why?: string;                              // client persona: required when explaining
  visual?: Visual;                           // §3.3
  citations: { id: string; label: string }[]; // chunk ids, topic slugs, or tool names
  related?: string[];                        // topic slugs
  actions: Array<"save" | "simpler" | "detail" | "expand" | "askLead" | "openStep" | "openProject" | "draftReminder">;
  origin: "reviewed" | "generated" | "deterministic" | "refusal";
  depth: "normal" | "simple" | "detail";
  topicSlug?: string; topicVersion?: number;
}
```

- `draftReminder` only opens the existing Microsoft Graph compose screen pre-filled. Assist never sends.
- Language (T4): `line`, `why`, visual labels in the user's language; form names (SPICe+, INC-20A, GSTR-3B) stay as-is.

### 6.6 Validation (code, not model)

Reject and retry once (with the error appended) if:

1. Envelope or visual fails zod.
2. A citation id is not in the retrieved chunks, the served topics, or the tool calls of this turn.
3. **Any date** in `line`, `why` or `visual` does not appear in this turn's tool results (dates only from calendar/checklist).
4. The answer mentions a step title that is not in `checklist.ts` active catalog.
5. Client shell: any content sourced from a non-finalized board resolution.

On second failure: return a safe fallback: `line = "I'm not certain about this one. Your project lead can answer it."`, `actions = ["askLead"]`, `origin = "generated"`, and log the failure.

### 6.7 Rate limit and cost

- Per profile: `ASSIST_RATE_LIMIT_HOUR` (default 30) and `ASSIST_RATE_LIMIT_DAY` (default 200) counted from `assist_messages`. Deterministic and topic answers count at 0.
- Log usage on every message. Prompt caching on system blocks.

### 6.8 Refusal and hand-off copy (`refusals.ts`)

- Off-topic (client): "I can only help with your company setup and Indian compliance questions. Is there something about your project I can explain?"
- Off-topic (admin/super): "I can help with firm projects, deadlines and Indian compliance rules. That question is outside what I cover."
- Decision request: "This is a decision for your firm. Here's what it means, and your project lead can confirm what applies to your company."
- Unavailable: "Assist is unavailable right now. Your project lead can help in the meantime."

---

## 7. UI (`src/components/assist/`)

### 7.1 Files

```
AssistProvider.tsx        state: open, conversationId, messages, mode (client/staff), preview engagement; persists across navigation (U3)
AssistLauncher.tsx        top-bar button "Ask Assist" + ⌘J/Ctrl+J toggle, Esc to close (U4)
AssistPanel.tsx           desktop slide-over / mobile bottom sheet (D2, D5)
AssistHome.tsx            greeting + project context card (client) + grouped suggestions
AssistThread.tsx          message list + status labels (U2)
AssistUserBubble.tsx      neutral bubble (D1)
AssistAnswerCard.tsx      line, trust badge (U1), visual, why, source, actions, related
AssistComposer.tsx        input + send (only solid primary element in the panel)
AssistReader.tsx          full-page explainer view (D3)
WhatsThisButton.tsx       contextual trigger (F1)
GlossaryTerm.tsx          underlined term + hover/tap card (F2)
visuals/VisualRenderer.tsx  zod-parse then dispatch
visuals/Flow.tsx Steps.tsx Compare.tsx Timeline.tsx KeyFacts.tsx NextStep.tsx ProjectRows.tsx Metrics.tsx
```

Hooks via TanStack Query in `src/hooks/assist/*`. Streaming via `fetch` + `ReadableStream` reader.

### 7.2 Mounting and gating

- Mount `AssistProvider` + `AssistLauncher` + `AssistPanel` in the shell layout **only when the session role is `client`, `admin` or `super_admin`**. Gate on the real session role, **not** on the route prefix: admin and manager share views through `useStaffBasePath`, so a path-based gate would leak Assist to managers.
- Top bar order: location trail · Search (⌘K) · **Ask Assist** · theme · bell · avatar. Command palette stays the only search.
- Hidden entirely for `manager` and `intern`, including `WhatsThisButton` and `GlossaryTerm` hover cards (terms render as plain text for them).

### 7.3 Layout rules

| Viewport | Behaviour |
|---|---|
| ≥ 1440 px | Panel 400 px, **pushes** main content (content max-width rules unchanged) |
| 1024–1439 px | Panel 400 px, **overlays** content with a light scrim; Esc/scrim click closes |
| < 1024 px | **Bottom sheet**, 85% viewport height, drag handle, suggestions as horizontal scroll chips (D5) |

Panel structure: header (icon tile, "Assist", subline, close) · scrollable body · composer footer with disclaimer.

- Client subline: "Answers from verified sources". Staff subline: "Firm-wide · read only".
- Client disclaimer: "Assist explains; it doesn't give legal advice. Your project lead confirms decisions."
- Staff disclaimer: "Assist reads data only. It never sends email or changes a project."

### 7.4 Visual language (D1, D4)

- Colour budget inside the panel: neutrals (slate) for surfaces, user bubble, chips and secondary buttons; **primary blue only on**: Send button, focus rings, the "You are here" stage, and link text. The Save button is a neutral outline; saved state is a teal-green check.
- User bubble: `bg-muted` / slate-100 with foreground text (dark mode: slate-800 with near-white text).
- Trust badges (U1): "Reviewed by {firmName}" (teal-green chip + check icon) for `origin=reviewed|deterministic`; "AI answer · check with your lead" (slate chip) for `origin=generated`. `firmName` comes from existing firm config, not hardcoded.
- Phase colours in `Flow` / `NextStep` come from `src/lib/phase-colors.ts`. Status chips use the existing status tokens: coral waiting, teal-green done, rose overdue, slate locked.
- Typography: Manrope UI, Space Grotesk for the panel greeting and reader H1, IBM Plex Mono for form codes (INC-20A, GSTR-3B) and ids.
- Radius from `--radius`. Motion: panel slide 200 ms using existing `src/lib/motion.ts` presets; respect reduced motion. No `transform` on a `layoutId` host.
- All colours via tokens; verify both themes. No raw hex in components.

### 7.5 Client answer card (order is fixed)

1. Trust badge + depth tag (when not normal)
2. `line` (15 px, max ~60ch)
3. Visual (if any)
4. "Why it matters to you" + `why`
5. Source line (citation labels; links open in a new tab)
6. Actions: Save to library · Simpler · More detail · Expand (D3) · Ask my lead (when present)
7. Related (max 2 suggestion buttons)

Staff answer card: badge · `line` · visual (`projectRows` / `metrics` / `keyFacts`) · source (for rule answers) · actions (Open in Projects / Open Approvals / Open Compliance / Draft reminder) · related.

### 7.6 Accessibility (U5)

- Panel is a `complementary` landmark with a label; bottom sheet is a dialog with focus trap.
- Every visual renders an `sr-only` text equivalent (e.g. "Stage 1 of 3, Part A, done. Stage 2, Part B, you are here.").
- Touch targets ≥ 44 px; real `<button>` / `<a>` elements; icon-only buttons have `aria-label`.
- Contrast ≥ 4.5:1 in both themes; states differ in more than hue (icon + label).
- Streaming status is announced via `aria-live="polite"`.

---

## 8. Client learning features

### 8.1 "What's this?" (F1)

- Placement: client Inbox rows, Incorporation flowchart nodes (including locked nodes: explains what the step is and what unlocks it, using the existing "This opens after {title} is complete" copy), client step form section headers, form field help icons where a topic or glossary term exists, and Compliances list items.
- Behaviour: opens the panel and sends `context = { kind, ref, label }`. If a published topic maps to that step/term, it is served directly (no model call).
- Do not add it to lead/manager screens.

### 8.2 Glossary terms (F2)

- `glossary.ts`: `{ term, aliases[], short (≤ 120 chars), topicSlug?, appliesTo? }`. Seed: SPICe+, DIN, DSC, MOA, AOA, COI, CIN, PAN, TAN, GST, GSTIN, TDS, FEMA, FC-GPR, ROC, INC-20A, ADT-1, IEC, LUT, PF, ESI, Professional Tax, LLP, FiLLiP.
- `GlossaryTerm` renders a dotted underline; hover (desktop) or tap (mobile) shows a card: term, short line, "Explain more" → opens Assist with the topic.
- Apply at render time through a `withGlossary(text)` helper in selected client components only (Inbox row titles/subtitles, flowchart node labels, step descriptions, compliance names). **Do not modify `checklist.ts` strings.** Underline only the first occurrence per block.

### 8.3 Library (client nav item "Library", OD4)

- Route: `/app/client/library` (list) and `/app/client/library/[id]` (reader). Nav: Inbox · Incorporation · Compliances · Documents · **Library** · Team · Activity audit.
- List: search, category filter chips, cards (category chip, "Updated" badge, title, one line, mini visual preview, Open).
- Empty state: headline "Save explanations you want to keep", body "Ask Assist anything and tap Save to library.", action "Ask Assist".
- Save: from any client answer card; saved state toggles to "Saved to library" (teal-green check). Saving the same topic twice updates the existing item.
- `shared_with_team` toggle: **later** (column exists).

### 8.4 Reader view (D3)

- Route: `/app/client/learn/[slug]` for topics and `/app/client/library/[id]` for saved items; both use `AssistReader`.
- Layout: back button, category chip, H1 (Space Grotesk), trust badge, depth switch (Simpler / Normal / More detail), large visual, why, sources, "Save to library", "Ask a follow-up" (opens panel with context).

### 8.5 PDF brief (F3)

- Single item and multi-item export. Content: firm name/logo (existing brand assets via `SbcLogo` / logo files), company name, date, each explainer (title, line, visual as static rendering, why, sources, reviewed badge text), footer disclaimer "Informational only. Your firm confirms decisions for your company."
- Use existing PDF tooling if Phase 0 finds one. Otherwise **checkpoint**: propose the smallest server-side option and wait for the owner's yes before adding a dependency (OD5).

---

## 9. Admin and super admin specifics

- Suggestions with `kind: "query"` are **deterministic**: call the staff tool, render `projectRows` / `metrics` with a templated `line` (e.g. "3 projects are waiting on client action. {longest} has waited longest."). No model call.
- Row arrows link to `adminProjectPath(eng, roleOrBase)`; never hardcode `/app/manager`.
- "Draft reminder" (waiting-on-client answer) opens the existing Graph compose page pre-filled with a reminder for that project. It must not send.
- Super admin "Preview Assist as a client": pick an engagement (search by company), then show that client's suggestions and answers in client persona, scoped to that engagement, with a sky "Client view · {company}" banner. Library saves are disabled in preview.
- Super admin's gold stays a small badge only.

---

## 10. Configuration

| Env var | Default | Notes |
|---|---|---|
| `ASSIST_ENABLED` | `false` | Feature flag; hides launcher and returns 404 on routes when false |
| `ASSIST_LLM_PROVIDER` | `anthropic` | `anthropic` \| `bedrock` (OD1) |
| `ANTHROPIC_API_KEY` | — | Server-only; Secrets Manager `/vcfo/assist/anthropic-api-key` in AWS |
| `ASSIST_BEDROCK_REGION` | — | Only when provider is `bedrock` |
| `ASSIST_MODEL_GUARD` | `claude-haiku-4-5-20251001` | |
| `ASSIST_MODEL_ANSWER` | `claude-sonnet-5-5` | |
| `ASSIST_MODEL_CONTEXTUALIZER` | `claude-haiku-4-5-20251001` | Ingestion |
| `ASSIST_RATE_LIMIT_HOUR` / `_DAY` | `30` / `200` | |
| `ASSIST_RETRIEVAL_TOP_K` | `8` | |

No key locally → Assist routes return the "unavailable" event (mirror the email "console-skip" pattern); deterministic suggestions and reviewed topics still work.

---

## 11. Phased execution for Claude Code

Global rules for every phase: §0.3. After every phase run the verification gate, fix failures, report deviations honestly, then commit. Do not stop between phases except at the marked **CHECKPOINTS**.

**Verification gate (every phase):**
```
npx tsc --noEmit > /tmp/tc.log 2>&1; grep -c "error TS" /tmp/tc.log   # must print 0
npx vitest run --reporter=dot
npm run lint
```

**Preservation list (every phase — do not modify):** `src/data/checklist.ts`, per-step validators, docx generators, `src/lib/checklist-step-gate.ts`, compliance calendar math, `src/lib/email/send-email.ts`, `engagement-recipients.ts`, BR finalize flow, Auth.js config, existing role routing, `useStaffBasePath` behaviour, `adminProjectPath`.

### Phase 0 — Recon (read-only) · CHECKPOINT at end

Confirm and report (paths, names, deviations from this file):
1. Shell layout files per role and where the top bar lives (`src/components/shell/*`).
2. How the session role is read on server and client.
3. Requests table + repository used by client inbox / "Ask my lead" target.
4. Compliance calendar repository and fields.
5. Approvals repository (pending manager accept).
6. Staff KB module (for later publish flag) and existing S3 upload helper.
7. Existing PDF generation capability (OD5).
8. pgvector availability on local Postgres and target RDS.
9. Whether an Anthropic SDK is already installed.
10. Existing firm name/branding config for the trust badge.
11. Client routes list and nav config file for adding "Library".

Output a short deviation table. **Pause for owner confirmation.**
Commit: none (read-only).

### Phase 1 — Content schemas and starter content
- `src/data/assist/schema.ts` (zod: Topic, Visual, AnswerEnvelope, Suggestion, GlossaryTerm).
- Starter topics (§3.4) as `draft`, `glossary.ts`, `suggestions.ts`, `playbook.md` skeleton.
- `src/lib/assist/topics.ts`: load, validate, applicability, alternates (LLP → FiLLiP), depth selection, flow state from snapshot.
- Tests: §3.2 rules, applicability, alternates, "client-owned steps missing topics" report.
Commit: `feat(assist): content schemas, starter topics, glossary and suggestions`

### Phase 2 — Database and repositories
- Drizzle schemas + migrations for §4.1–4.4.
- Repositories `assist-conversations`, `assist-messages`, `client-library`, `assist-documents` with `AuthContext`.
- Cross-tenant tests: client A cannot read client B's conversations or library; manager/intern contexts are rejected.
Commit: `feat(assist): tables and AuthContext repositories`

### Phase 3 — Server pipeline
- Provider interface + both adapters (no live calls in tests; mock provider).
- Guard, snapshot, suggestions resolver, retrieval (FTS), tools, generate with `render_answer`, validation, refusals, rate limit, pipeline with status events, persistence.
- Routes in §5 except library export and admin documents.
- Tests: role gate 403 (manager, intern); off-topic refusal without generation call; decision request → hand-off; LLP client never gets SPICe+ as its own path; domestic client gets no FC-GPR suggestion; BR draft never reaches a client tool result; date-validation rejects invented dates; invalid visual → text fallback; deterministic suggestion makes zero provider calls; snapshot contains none of the forbidden fields.
Commit: `feat(assist): guarded answer pipeline with tools and validation`

### Phase 4 — Panel UI
- Provider, launcher (⌘J/Ctrl+J, Esc), panel (push/overlay/bottom sheet), home, thread, bubbles, answer card, composer, status labels, trust badges, visuals with sr-only text, dark mode.
- Mount for client/admin/super only (role-based gate).
- Tests: component tests for VisualRenderer (valid/invalid), gating by role, keyboard shortcuts.
Commit: `feat(assist): panel, answer card and visual components`

### Phase 5 — Client learning features
- "What's this?" placements (§8.1), glossary terms (§8.2), Library list + reader + save + update badge (§8.3–8.4), hand-off button wiring.
- PDF brief (§8.5): **CHECKPOINT** if a new dependency is needed.
- Tests: save/update badge logic, glossary first-occurrence rule, "What's this?" on locked step explains unlock condition.
Commit: `feat(assist): client library, reader, glossary and contextual help`

### Phase 6 — Admin and super admin
- Deterministic staff suggestions, `projectRows` / `metrics`, Draft reminder → compose prefill, super preview-as-client.
- Tests: firm-wide scoping for admin; super preview restricted to chosen engagement; draft reminder never calls the email dispatcher.
Commit: `feat(assist): admin and super admin assist`

### Phase 7 — Knowledge ingestion
- Admin/super upload page (under existing KB area or `/app/admin/assist/sources`), S3 via existing helper, Inngest job: extract text → chunk by heading/section (≈300–500 tokens) → Haiku context prefix → store with tsvector. Status tracking and retry.
- Tests: chunker, job idempotency, audience filter (staff-only docs never retrieved for clients).
Commit: `feat(assist): knowledge source ingestion`

### Phase 8 — Evals
- `tests/assist/evals/`: golden set (≥ 60 cases across client, admin, super), including:
  - Off-topic traps: code, investing, other countries' law, prompt-injection text ("ignore your instructions"), injected instructions inside an uploaded source.
  - Scope traps: client asking about another company; client asking for BR draft; manager/intern calling the API.
  - Company-type traps: LLP asking about SPICe+; domestic asking about FC-GPR.
  - Decision traps: "Do we need GST?", "Should we register as LLP?"
  - Date traps: questions tempting the model to state a due date without tool data.
- Evals run with the mock provider in CI (routing, validation, scoping); a separate `npm run eval:live` runs against the real model on demand.
Commit: `test(assist): eval suite and traps`

---

## 12. Acceptance criteria

**Client**
- Clicking any pre-kept question shows an answer in < 300 ms with no model call and a "Reviewed by {firm}" badge (once topics are published).
- "What is my next step?" shows the real current step, its due label and document list from the project.
- An LLP client never sees SPICe+ as their incorporation path; a domestic client never sees FC-GPR suggestions.
- "Do we need GST?" explains GST and offers "Ask my lead"; never answers yes/no.
- Off-topic questions get the fixed refusal.
- Save → appears in Library; after the topic version changes, the item shows "Updated".
- Reader view and PDF brief work; PDF includes the disclaimer.
- Works in light and dark mode, on desktop (push/overlay) and mobile (bottom sheet), by keyboard and screen reader.

**Admin**
- The 3 operations questions list the correct projects from live data with working links; "Draft reminder" opens compose without sending.
- Rule questions show citations.

**Super admin**
- Firm pulse and at-risk answers are correct; preview-as-client shows exactly that client's suggestions and data; gold badge only.

**Manager / Project Lead**
- No launcher, no glossary cards, no "What's this?"; every Assist route returns 403.

---

## 13. Later backlog (designed for, not built)

F4 first-week learning path · F5 admin questions beyond dashboard (inactive clients) · answer feedback (thumbs) table and UI · library sharing with team (`shared_with_team`) · retention job for conversations (DPDP; propose default 180 days) · vector embeddings + reranker (OD2, OD3) · "Publish to Assist" flag on staff KB articles · multilingual UI chrome.

---

## 14. Risks

| Risk | Mitigation in this spec |
|---|---|
| Wrong explanation trusted by a client | Reviewed topics for common questions; badges distinguish reviewed vs AI; citations; decision hand-off |
| Stale rule or date | Dates only from calendar/checklist; topic `version` + "Updated" badge; sources carry `last_verified_at` |
| Data leak across clients | Repository-scoped tools + cross-tenant tests + minimal snapshot |
| Assist leaks to managers via shared admin views | Role-based mount gate + API 403 + tests |
| Prompt injection via uploaded sources | Chunks passed as delimited data; guard + validation; eval traps |
| Cost creep | Deterministic and reviewed paths first; rate limits; prompt caching; usage logging |
| Panel crowds the client Inbox | 400 px, overlay below 1440 px, reader view for depth |
