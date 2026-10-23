# Ask VCFO — RAG upgrade guide (learn it, then build it together)

Written for: Prithish, as a learning guide and a build plan. Dated 2026-10-22.
Everything below was checked against the code in this repo (`src/lib/ask/`,
`src/db/repositories/ask-documents.ts`, `src/db/schema.ts`, `docker-compose.yml`).

---

## Part 1 — What you must understand first (read this before any code)

### 1.1 What an LLM does and does not know

Claude (Sonnet, Haiku) was trained on text up to a cut-off date. It knows general
company law, GST, MCA forms. It does **not** know SBC's own circulars, your fee
notes, your internal process documents, or anything written after its training.
If you ask it about those, it either says "I don't know" or, worse, **guesses**
confidently. Guessing is called a *hallucination*.

### 1.2 What RAG is, in one sentence

**RAG = Retrieval-Augmented Generation**: before the model answers, we *retrieve*
the relevant pieces of our own documents and paste them into the prompt, so the
model answers *from our text* instead of from memory.

Three stages, always:

| Stage | Plain words | Where it lives in Ask VCFO today |
|---|---|---|
| **Ingest** | Take a document, cut it into pieces ("chunks"), store the pieces | `src/lib/ask/ingest/` → table `ask_chunks` |
| **Retrieve** | When a question comes, find the few chunks that match it | `src/lib/ask/retrieve.ts` → `searchAskChunks` |
| **Generate** | Give the model the question + those chunks, with the rule "cite them" | `src/lib/ask/generate.ts` + `validate.ts` |

So Ask VCFO **already is a RAG**. What it lacks is a good *retrieve* stage.

### 1.3 Keyword search versus meaning search

Today's retrieve uses PostgreSQL full-text search (`websearch_to_tsquery`,
`ts_rank`). It matches **words**. "late filing fine" does not find a chunk that
says "penalty for delayed submission", because no word is shared.

Meaning search uses **embeddings**. An embedding model turns a sentence into a
list of numbers (a *vector*, typically 1,024 numbers). Sentences with similar
meaning get vectors that point in similar directions. We store one vector per
chunk; at question time we embed the question and ask the database "which chunk
vectors are closest to this one?" (*cosine similarity*). "fine" and "penalty"
land close together, so the chunk is found.

Both have strengths:

| | Keyword (today) | Vector (to add) |
|---|---|---|
| Finds synonyms, paraphrases | no | yes |
| Finds exact codes, form names ("INC-20A", "62011") | yes, very well | weak |
| Needs an extra AI call per question | no | yes (cheap, ~1 ms of compute, fractions of a paisa) |
| Needs a database extension | no | yes (`pgvector`) |

That is why production systems use **hybrid search**: run both, merge the two
ranked lists (a standard formula called *Reciprocal Rank Fusion*, RRF), and
optionally pass the merged top 20 through a **reranker** model that re-sorts
them by relevance and keeps the top 8. We will do keyword + vector + RRF; the
reranker is an optional later step.

### 1.4 Chunking and "contextual retrieval" (already done here, and done well)

A chunk of 300–500 words is the sweet spot: small enough to be precise, big
enough to carry meaning. Ask VCFO also runs each chunk through Haiku to write a
one-line "this piece is from section X of document Y" prefix
(`ingest/contextualize.ts`). This is Anthropic's "contextual retrieval"
technique and it improves both keyword and vector search. Keep it.

### 1.5 Why the rest of the pipeline must stay as it is

The guard (Haiku classifies the question), the read-only tools (live project
data), the validator (rejects answers that cite a source that was not retrieved
or state a date that no tool returned), and the rate limit are what make the
assistant safe for a CA firm. **The retrieve stage is a plug**: as long as our
new search returns the same `RetrievedSource[]` shape (`id`, `kind`, `label`,
`text`, `url`), nothing else changes.

### 1.6 Vocabulary you will meet

- **Embedding model**: the model that makes vectors. Anthropic does not sell one.
  Options: **Amazon Bedrock Titan Text Embeddings V2** (fits the "one AWS
  invoice" rule this project already follows for SES, S3 and WhatsApp), **Voyage
  AI** (Anthropic's recommended partner), Cohere, OpenAI.
- **pgvector**: a PostgreSQL extension that adds a `vector` column type, the
  `<=>` cosine-distance operator and an index type (HNSW) for fast nearest-
  neighbour search. RDS Postgres supports it; our local `postgres:16` image does
  not, so local Docker must switch to the `pgvector/pgvector:pg16` image.
- **Top-k**: how many chunks we hand to the model (`ASK_VCFO_RETRIEVAL_TOP_K`,
  default 8).
- **Dimensions**: the length of each vector. Titan V2 = 1,024 (can be 512 / 256).
  The column must be declared with that exact number.
- **Evaluation set**: 20–30 real questions with the chunk that *should* be found.
  We measure "did the right chunk land in the top 8?" (*recall@8*) before and
  after. Without this you cannot tell whether the upgrade helped.

### 1.7 Learning to do on your side (about two evenings)

1. Read Anthropic's "Contextual Retrieval" article (it describes exactly the
   hybrid + contextual design we are building).
2. Read the pgvector README: the `vector` type, `<=>`, HNSW index.
3. Skim Bedrock's Titan Text Embeddings V2 page: input limits (8,192 tokens),
   `dimensions`, `normalize`.
4. In this repo, read in this order, ~40 minutes: `src/lib/ask/pipeline.ts`
   (follow one question top to bottom), `retrieve.ts`, `ingest/run.ts`,
   `ingest/chunk.ts`, `src/db/repositories/ask-documents.ts` (`searchAskChunks`),
   and `docs/specs/ask-vcfo/ASK-VCFO-CONTEXT.md` section on retrieval.

---

## Part 2 — What the chatbot can already do (so you know the surface you own)

- Chat panel for clients, admins and super admins (⌘J / Ctrl J; managers and
  leads are blocked by `src/lib/ask/access.ts`).
- Ready-made suggestions (no AI call), "What's this?" field help (pre-written),
  glossary underlines.
- 39 reviewed-content topics (all still **draft** → answers badge "Not yet
  reviewed"); publish flow in `topic-review.ts` / `topic-publish.ts`.
- Read-only tools the model may call: project status, phase progress, step
  details, upcoming filings (client); waiting-on-client, overdue filings,
  pending approvals, firm overview (staff).
- Document ingestion: Admin → Ask VCFO → Sources (PDF via Haiku transcription,
  DOCX, text), audience tag client / staff / both, Inngest job or inline.
- Saved answers (client Library), monthly status brief PDF, daily nudge,
  "explain this delivered document", "what if I miss it" — behind
  `ASK_VCFO_FEATURE_C1…C5` flags, all off.
- Question-gaps report for admins (`ASK_VCFO_FEATURE_A1`, off): which client
  questions had no reviewed topic — this is your best source for the evaluation
  set and for what documents to upload.
- Usage and tokens are stored per message (`ask_messages`), so cost is visible.

---

## Progress log

- **2026-10-22 — upload and keyword RAG made to work end to end.** Drag-and-drop on the
  Sources page; PDFs read from their text layer with `unpdf` (any length, free) instead of
  being retyped by Haiku; the guard and Sonnet now treat the firm's own documents as in
  scope; keyword search tops up the strict all-words match with an any-word match. Proven
  with a 2-page test note and the 57-page knowledge-transfer PDF. Remaining gap, shown live:
  "Who is the owner of VCFO Suite?" finds pieces about the owner section but not the cover
  page, so it answers "not certain". That is exactly the ranking problem Steps 1–4 below
  (vectors + hybrid) solve.

- **2026-10-23 — official-update watchers.** Ask VCFO now reads new GST notifications and
  circulars (CBIC) and RBI FEMA notices by itself every morning, summarises what changed,
  and answers "what changed / is there a new rule" questions with the notification number
  and date. New updates reach staff at once and clients after an admin publishes them.
  This is "freshness" in RAG terms: the knowledge base updates itself, and the newest
  source wins when two disagree.

- **2026-10-23 (later) — manager review gate.** A found update is now `pending` until a
  manager approves it on the Regulatory updates page, after reading a generated review PDF
  (facts, what changed, amends, effective date, reading check, opening text). Nothing pending
  or rejected is ever retrieved. Approval posts an Announcement and notifies clients and
  staff. In RAG terms this is **human-in-the-loop curation of the knowledge base**: the
  retriever only sees what a person has vouched for.

## Part 3 — The build plan, step by step (we do each step together)

Each step says: what you learn, what gets built, how we both check it. Each step
is small enough to typecheck and test on its own; we never stack unverified work
(golden rule 5 in CLAUDE.md).

### Step 0 — Fill the knowledge base and write the evaluation set (you, no code)

- Upload 5–10 real documents on Admin → Ask VCFO → Sources (local first).
  Today the local store has **0 documents, 0 chunks**; a better search over an
  empty table changes nothing.
- Write `docs/specs/ask-vcfo/eval/questions.jsonl`: 20–30 questions a client or
  a lead would actually ask, each with the document and the sentence that
  answers it. Include synonyms on purpose ("fine" vs "penalty", "office" vs
  "registered address").
- Check: `select count(*) from ask_chunks` > 0; a few questions already answer
  well with keyword search, a few do not. We keep those "do not" ones as the
  proof the upgrade is needed.

### Step 1 — Local database learns vectors (infrastructure, ~30 min)

- Change `docker-compose.yml` Postgres image to `pgvector/pgvector:pg16`
  (same data volume; the extension is just available, not yet enabled).
- Migration `0027_ask_chunks_embedding.sql`: `CREATE EXTENSION IF NOT EXISTS vector;`
  then `ALTER TABLE ask_chunks ADD COLUMN embedding vector(1024);` and an HNSW
  index `USING hnsw (embedding vector_cosine_ops)`. Schema.ts gets a matching
  `customType` column (Drizzle has no built-in vector type; we write a 10-line
  custom type).
- Check: `npm run db:migrate` green locally; `select extname from pg_extension`
  lists `vector`; typecheck 0.
- You learn: what an extension is, why the dimension is fixed, what HNSW is.

### Step 2 — An embedding provider behind the existing provider switch (~1 h)

- New `src/lib/ask/embeddings/` with one interface `embed(texts: string[]):
  Promise<number[][]>` and two implementations: `bedrock-titan.ts` (default,
  `amazon.titan-embed-text-v2:0`, `dimensions: 1024`, `normalize: true`,
  batched, retried) and a `none.ts` that returns `null` so everything still
  works when no embedding key is configured (vector search simply switches
  off). Config in `src/lib/ask/config.ts`: `ASK_VCFO_EMBEDDINGS=bedrock|none`,
  `ASK_VCFO_EMBEDDING_MODEL`, `ASK_VCFO_EMBEDDING_DIMENSIONS`.
- Unit test with a fake provider: same text → same vector; batch of 50 splits
  into Bedrock's limits.
- Check: a tiny script embeds "penalty for late filing" and "fine for delayed
  submission" and prints their cosine similarity (expect ~0.8+), versus
  "registered office address" (expect ~0.2). You will *see* meaning as numbers.

### Step 3 — Ingest writes vectors (~45 min)

- In `ingest/run.ts`, after `contextualizeChunks`, embed `contextPrefix + "\n" +
  text` for every chunk and store it in `embedding`. A `scripts/ask-embed-
  backfill.ts` embeds the chunks that already exist (so Step 0's uploads get
  vectors without re-uploading).
- Check: `select count(*) filter (where embedding is null) from ask_chunks` = 0;
  re-ingesting a document is still idempotent (chunks replaced, not duplicated).

### Step 4 — Hybrid retrieval (the heart, ~1.5 h)

- `searchAskChunks` becomes two queries run in parallel: the existing keyword
  query (top 20) and a vector query `ORDER BY embedding <=> $queryVector LIMIT
  20`, both filtered by `status = 'ready'` and the audience rule (**a client can
  never widen to staff** — this guard stays exactly where it is).
- Merge with Reciprocal Rank Fusion: `score = Σ 1 / (60 + rank_in_list)`; sort;
  take `topK`. Pure function `fuseRanks()` in `src/lib/ask/retrieve-fuse.ts`
  with its own tests (a chunk ranked 1st in both lists beats one ranked 1st in
  one list only; a chunk missing from both never appears).
- `retrieve.ts` keeps its output shape; `pipeline.ts` is untouched; the
  validator keeps rejecting citations of ids that were not retrieved.
- Check: run the evaluation set three ways (keyword only, vector only, hybrid)
  with `scripts/ask-eval-retrieval.ts` and print recall@8 for each. Hybrid must
  be ≥ both. This is your "did it help" proof.

### Step 5 — Observability and cost (~30 min)

- Store, per message, which chunk ids came from keyword, vector or both, and the
  embedding tokens used (`ask_messages` already stores usage JSON; add keys, no
  new table).
- Admin → Ask VCFO → Sources shows "embedded n / m chunks" per document and an
  "Embed missing" button.
- Check: one question in the admin preview shows its sources with a small
  K / V / K+V tag.

### Step 6 — Production (~30 min, you run the AWS parts)

- RDS: `CREATE EXTENSION vector` (RDS allows it), run migration 0027, set
  `ASK_VCFO_EMBEDDINGS=bedrock` and the Bedrock region in Terraform
  (`infra/`), grant the App Runner role `bedrock:InvokeModel` for the Titan
  model, deploy, run the backfill once against RDS.
- Check: the live site answers the Step 0 "do not" questions correctly, with
  citations.

### Step 7 (optional, later) — Reranker and query rewriting

- Reranker: Bedrock Cohere Rerank or Voyage rerank over the top 20 fused
  results → top 8. Only if the eval set shows the right chunk is often in the
  top 20 but not the top 8.
- Query rewriting: the guard already rewrites the question to stand alone; we
  can also ask it for 2–3 paraphrases and embed all of them (multi-query).
- Publishing the 39 draft topics: a review task for the firm, not code, but it
  removes the "Not yet reviewed" badge and gives the model better evidence than
  any chunk.

### What stays exactly as it is

Guard, tools, validator, refusals, rate limits, citations, audience rules,
Inngest job shape, the chat UI. The upgrade touches: `docker-compose.yml`, one
migration, `schema.ts`, `config.ts`, `ingest/run.ts`, `ask-documents.ts`
(`searchAskChunks`), one new folder `embeddings/`, one new file
`retrieve-fuse.ts`, two scripts, tests, and the admin Sources page.

### Order of work and how we pair on it

For each step: I explain the step in chat in plain words → you say go → I build
it and show you the exact diff and the check → you run the check yourself on
localhost → we move on. Nothing is committed until you say so. Expect roughly
one working day across steps 1–5, plus Step 0 and Step 6 on your side.
