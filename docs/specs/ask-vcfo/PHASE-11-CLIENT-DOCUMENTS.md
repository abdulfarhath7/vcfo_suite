# Phase 11: Ask VCFO reads client documents

Status: planned on 6 November 2026, not built. The owner asked for this to be planned only. It is not
part of phases 0 to 10, and the running build does not change for it. It starts when the owner says go.

## The gap

Ask searches shared knowledge (`ask_documents`, `ask_chunks`) and short record cards (`ask_index_items`).
Nothing reads the files clients and staff upload, so "what does Acme's MOA say about borrowing?" and
"what date is on this notice?" cannot be answered, although the files are in the app. Neither table can
simply take these files:

- `ask_chunks` has no engagement column, and `searchAskChunks` scopes by audience only. A client's file
  text placed there could reach another client.
- `ask_index_items` allows one row per source, through `ask_index_items_source_uq`, so it cannot hold a
  long file in chunks.

## The decision

Add one new table, `ask_file_chunks`, used by one new repository, `src/db/repositories/ask-file-chunks.ts`.
Keeping client text out of `ask_chunks` means a bug in the shared knowledge search cannot return it.

Each row holds the engagement id, the source file, the page, the chunk text with identity numbers masked,
a full text column, and an optional 512-dimension embedding. The source is one of two nullable foreign keys
with a check that exactly one is set, both `on delete cascade`, so removing a file or an engagement removes
its text.

## What gets indexed

| Source | First release | Why |
|---|---|---|
| `documents` (the vault) | Yes | MOA, AOA, certificates, reports and deliverables |
| `document_request_files` | Yes | What clients upload against a request |
| `board_meeting_documents`, `compliance_task_attachments`, `labour_register_documents` | Later | Add when asked for |
| `ask_attachments` | No | Chat files are read once for a changeset and are not knowledge |
| Emails and Teams | No | Needs a separate privacy decision |

The `documents` schema warns that a stored file may have no row, because milestone uploads work off object
paths. The build must count stored files that have no row, report the number, and index through
`indexMilestoneUpload` rows rather than walking the bucket.

## Never indexed

- Identity documents. Reuse `ID_DOC_TEXT` and the identity checks in `src/lib/ask/data-router/read.ts`. A file
  that looks like one is skipped and logged by id, and its text is not stored.
- Images. Only what `sourceKindFor` accepts is read: PDF, DOCX and text.
- Scanned PDFs in the first release. They need a model call on client data, so they wait for the DPDP advice.
- Replaced files. A newer upload takes over, and old text leaves search at once.

Identity numbers in any other file are masked with `maskIdentityNumbers` before the text is stored.

## How a question runs

1. The router marks the question as being about a file, or code sees a file word such as MOA or notice.
2. The search is locked to one engagement. A client always gets their own. A staff member gets the company
   named in the question, or the record on the current page, and is asked when there are two. There is no
   firm-wide file search in this phase.
3. Full text and vector results merge by the existing rank fusion, down to at most 4 sources.
4. **Every hit is rechecked against the live file rules before the model sees it.** See below.
5. The model answers with the file name and page, and the link opens through the existing download check.

## Access rules

The main risk is that access to a file changes after it is indexed. A client sees a vault file only when
`shared_with_client` is true and its checklist step is released, and that can change at any time. So no
audience value is copied into `ask_file_chunks`:

- The search joins the source row, so a file deleted from the vault disappears at once and Undo brings it back.
- Hits go through the same rules as `listDocuments`, `getDocumentById` and `client-documents.ts`. Reuse those
  rules and do not write a second copy.
- Staff are scoped by `listScopedEngagementIds` and `assertEngagementAccess`, and role checks use the
  helpers in `src/lib/auth.ts`.
- Board resolution drafts never reach a client.
- A developer session reads nothing, and rule G-01 does not change.

## Safety

- File text is data, never instructions. It goes inside source tags, and a hostile file cannot start an action.
  Any change it leads to is still a changeset a person approves.
- An answer using a client file is never stored as a saved answer, in the same way as an answer using a record card.
- New flag `ASK_CLIENT_DOCS_ENABLED`, off in production by default, with its own kill switch and per-path budget.
  It stays off until the DPDP advice is in.
- Embeddings send client text to Bedrock, inside our AWS account. Confirm this in the DPDP advice before they are
  switched on for this table. Full text works without them.

## Token use

- Text is read locally with `pdfText`, at no model cost.
- No contextualizer call per chunk. Code builds the prefix from the file name, step and company.
- Answers use Haiku first and at most 4 sources, like document answers today (about 2,400 tokens in, 720 out).
- A question that never mentions a file does not search this table.

## Keeping it current

- A new upload sends an event to an Inngest job, with the in-process fallback the record cards use, so upload
  speed does not change.
- A nightly sweep catches anything missed, comparing by content hash.
- A one-time backfill runs through a script and reports files read, skipped and failed, with reasons.

## Build order

1. Migration for `ask_file_chunks`, using the next free number, with its repository and cross-tenant tests.
2. Reader and chunker with the skip rules, the upload job, the sweep and the backfill.
3. Search with the live recheck, the new path in the pipeline, and the budget and flag.
4. Answer card with file name, page and link.
5. Browser checks for each role, and an eval set on synthetic files.

## Done when

- A client asking about their own shared file gets the right answer with file name and page.
- A client gets nothing from another client's file, from a file not shared, from an unreleased step, or from a file
  deleted a moment ago. Each case has a test that fails if the text reaches the model.
- A lead gets nothing from a client outside their scope.
- A synthetic PAN card and Aadhaar are skipped, and no raw identity number is stored in any row.
- A hostile file cannot change what the chat does.
- Replacing a file removes the old text from answers at once.
- Tokens per answer are at or below today's document answers, and nothing regresses in the eval set.

## Needs the owner

- DPDP advice on reading client files and on embeddings, before production is switched on.
- Which vault categories to start with, if some should stay out, such as bank statements or financials.
