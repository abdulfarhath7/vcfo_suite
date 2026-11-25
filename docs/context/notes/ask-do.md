# Ask VCFO: paste and file

Gotchas already paid for once. Append when something costs more than a minute to figure out. The design is in
`docs/specs/ask-vcfo/MASTER-PLAN.txt` and `BUILD-PLAN.md`, phase 4.

## How a file or a paste becomes a card

- `src/lib/ask/do/entry.ts` is the fixed workflow: read, lock the client, place values, plan rows, save the card. There
  is no agent loop. `data-router/place.ts` is shared with the golden set, so the eval runs the code production runs.
- The cheapest step goes first. A form, labelled lines and a table are read by code with no model. The model reads only
  prose and picks only from catalog candidates, and code checks what it picked. Identity numbers are tokenised before
  the model sees text, and a value from text must appear verbatim in it.
- With `ASK_ID_DOC_READING` off, an image or a scan is refused before any model call, and so is text naming an identity
  document. Typed pastes still work, masked.
- The company comes from the message, then the page, then the only project, then the document. A named company out of
  reach reads nothing and never falls back to the page. A document naming another company asks; "Yes, file it for X"
  answers. The waiting state is an `ask_runs` row with status `waiting_reply`.
- A company name only identifies the client, except on a certificate of incorporation.

## How a plain request becomes a card (actions)

- A `do_work` request with no file goes to `src/lib/ask/do/pick-action.ts` first. One small structured-output call reads
  it into plain fields (action, company, step, title, status, date, note, subject, body). Code then finds the client
  with `lockEngagement` inside the person's scope, the step with `resolveStep`, and parses the action's own zod input.
  The model never sees an id and can only name an action `pickableActions` offered for that role. `none` falls through
  to the data router, which still owns filling checklist answers.
- Actions live in `src/lib/actions/<area>/index.ts` with a `capability` line; "What can you do?" is built from those
  lines (`src/lib/ask/capabilities.ts`), so the list and the chat never disagree. An action without `capability` works
  but is not listed.
- T2 (`tasks.create`, `statuses.setStep`) and T3 (`requests.create`, `reminders.client`) go on the same card as a fill.
  T3 cards carry `recipients`, shown as "Goes to … once you accept". T1 (`reminders.draftEmail`) runs at once and only
  returns a compose link; it sends nothing. T4 is never registered.
- Each action calls the code its screen calls: `createTask`, `applyChecklistPatch`, `createDocumentRequest` plus
  `notifyEngagementEventSoon`, `sendClientReminder`. Outward actions have no undo because the email has gone; a task's
  undo marks it not applicable, and a status undo only runs if nobody changed the status since.
- A reminder with no step named goes to the step waiting on the client now. The 24-hour limit is checked again at the
  click, so a card prepared twice cannot send twice.

## Rows and approval

- `gate`, `owner` and `condition` hold a row. `format`, `answer` and `validator` wait for an edit. `conflict`,
  `other_step` and `documents_differ` allow Accept, but "Accept all clear rows" leaves them for their own click.
- A row whose condition parent is empty gets a question row first. Answering it rechecks in order and releases its
  children, so a resident question can free the PAN row below it.
- The approval is an atomic claim on status, hash and expiry. Every row is checked again at the click by
  `src/lib/actions/checklist/rules.ts`, and it writes through `checklistPatchForRole`, the same code the screen uses.
- The field catalog is generated: run `npm run ask:catalog` after changing a source, or `catalog.test.ts` fails.

## How a drop becomes cards (folders, ZIPs, up to 50 files)

The plan and its decisions are in `docs/specs/ask-vcfo/DROP-PLAN.md`.

- A drop is an `ask_runs` row with `workflow: 'drop'`; its `state` is a `DropState` (`src/lib/ask/drop/types.ts`). The
  composer creates it (`POST /api/ask/drops`), uploads four files at a time with `dropId` and `relativePath`, then
  starts it (`POST /api/ask/drops/:id/start`). Five files or fewer with no folder still take the old chat path.
- The job is `src/jobs/ask-drop.ts` (event `ask/drop.run`, one drop at a time per person) with four steps from
  `src/lib/ask/drop/run.ts`: unpack, read each file, sort, finish. `queueAskDrop` runs the same steps in this process
  when Inngest is not reachable, so local dev needs no Inngest. Every step rebuilds the owner's `AuthContext` with
  `askRunActor`, so the job reaches only what the person could.
- What a file read is lives in S3 beside the file (`.../drops/<run>/reads/<attachment>.json`), never in the run row or
  an Inngest step result. The run row is masked, so it could not carry a PAN to the card anyway.
- Sorting is code first (`classify.ts`), then `assemble.ts` with the person's repositories. The client comes from the
  company the document names, then the folders (deepest first), the file name, the folder's siblings, the message,
  the page and the person's only project. The state of a labour register: a reply, then a state or city in the names
  (flagged `stateNew`, "new for this client: please check", when the client has filed only in other states), then the
  client's latest batch, then the registered office, which is flagged `stateAssumed` and shown as "(assumed from the
  registered office)". The state can be changed on the card ("Edit" offers the states; `rowStateEditable`).
- Every file row is the action's own `preview`, so the card shows what the action will do. A row's `attachmentId` and
  a compliance `taskId` must be UUIDs, or the action's input refuses the row and the file is left out with "I could not
  prepare this file for the card". That cost a while in the golden test.
- One card per client, titled "Client: N files, M values". Files that cannot be placed go into one "Where should these
  go?" message and the run waits in `waiting_reply`, even when it made cards. `parseDropReply` reads the answer, and its
  rows go onto that client's open card (`appendAskChangesetRows`) or a new one.
- `.xls` and `.ods` are refused before reading with "save it as .xlsx" (`dropFileRefusal`). A ZIP is unpacked with
  `fflate` inside the job: 50 entries, 200 MB, 25 MB per entry, a pack ratio of 100, no nested or encrypted entries.
- The 400k token budget is checked before every model call (`run-context.ts`). Over it, the drop stops, keeps its cards
  and lists the files it did not read or sort; the run is stored as `over_budget`.
- A labour sheet (`isLabourSheet`) is never read as values and costs no tokens. The month comes from the attendance
  grid's dates, then the file and folder names (`parsePeriodHint`); sheet names are not used.

## Reading every document (PLAN M)

- Each file is read twice at most. The first read (`read.ts`) finds the document type and the labelled values. When
  the type is known, `addTargeted` (`data-router/targeted.ts`) asks one more model call for the catalog fields that
  list that type in `foundIn` (`field-catalog/rules.ts`) and that the first read did not find (`missingTargets`). The
  reply cap is 4,000 tokens so prose fits. A board resolution gives the business description, NIC code, proposed
  names, capital and signatory; an MOA gives the main objects and capital; a COI gives CIN, PAN, TAN and the date; a
  PAN card gives the director's name, father's name, date of birth and PAN.
- The anti-hallucination rule: every targeted value carries a quote, and the quote must appear in the document text.
  A short value must appear word for word. A long text (business description, main objects) may be a cleaned summary
  of at most 1,000 characters, but its quote needs three or more words and 60% of its words must be the document's
  own. A visual read (a scan) must still give a quote and its confidence is capped at 0.9. A value that fails is
  dropped, not shown.
- A targeted value carries `targetKey`, so placing goes straight to that catalog entry. An entry with `fills`
  (`company.main_objects`) writes to another entry's fields (`company.business_description`); when a board
  resolution also gives a description, the card shows the two as "documents differ".
- Document types added: `board_resolution`, `moa`, `aoa`, `noc`, `address_proof`, `consent_letter`. A vague type
  from the model (other, form, company letter) is replaced by `guessDocType`, from the words and the file name.
- PDFs with scanned pages: `pdf-pages.ts` finds the pages with under 40 characters of text and an image. Text pages
  are read as text; scanned pages are rendered (unpdf with `@napi-rs/canvas`, 1,400 px JPEG, five per call, 30 at
  most) and sent as pictures labelled "Page n". When rendering fails the whole PDF goes as a document block (20 MB).
- Excel: `cellText` gives a formula its result, rich text its characters, a link its text and a date as
  YYYY-MM-DD, so no "[object Object]" reaches the model. Word: tables are read as rows joined with " | " in the
  order they sit, and the headers, footers, footnotes and endnotes are added once each.
- Emails: `.eml` (postal-mime) and `.msg` (@kenjiuno/msgreader) are read by `drop/email.ts`. The attachments are
  read first, as files of their own (10 at most, two levels deep), then the body as prose. Each attachment value
  carries `from`, so the card says "Quarry office NOC.eml › Office NOC.pdf". An old `.doc` is refused with "save
  it as .docx".
- An email file itself is kept in the vault, never in a checklist upload field: its type comes from its attachment,
  so without that rule the .eml was filed as the office NOC (`classify.ts`, found in the 25 Nov browser check).
- Strict facts: a catalog entry with `onlyFrom` is filled from a file only when the file is one of those document
  types (`form`, and any workbook, counts as the client's details sheet); pasted text is not limited. The date of
  incorporation, CIN, company PAN and TAN come only from a certificate, a PAN card or the details sheet. An entry
  with `valueMatches` also needs its value to match a pattern, so GST "nature of possession" takes "rented" or
  "owned", never an address. `placementRefusal` (`place.ts`) decides; a refused value is listed under "I could not
  place these" with its reason, and the field chooser is never offered a field the file may not fill.
- Two documents on one fact: the first value stays on the row, and the `documents_differ` check names the other file
  and carries its value as `choice`, which the card offers as "Use this" (not for sensitive fields). A value read for
  its own field comes before one that only `fills` it, so the board resolution's description leads and the MOA's
  main objects are the choice. `recheckRows` keeps this check until the row is edited; before 26 Nov a recheck wiped
  it, which is why the live run showed only one description. The summary support check compares five-letter stems
  and ignores glue words ("company", "will"), so "develop and license" matches "developing, licensing".
- Sources on the card: every row keeps its file, page and a masked quote of up to 300 characters; `rowSourceText`
  (`changeset/view.ts`) shows the file, the page and 160 characters of the quote.
- Speed: `dropReadBatch` reads three files at a time with one shared budget. Writes to the run row are serialised.
  Each file records its time (`ms`) and value count, and the progress line says "Read 12 of 50 · 3 values from the
  board resolution". A batch checks the budget before each read, so the 400k budget can be passed by up to two
  reads that were already running.
- Cost: a targeted read sends the document text (60,000 characters at most, about 3k to 15k tokens) and gets up to
  4k tokens back. A typical incorporation fetch of ten to fifteen documents costs about 50k to 150k tokens.

## Testing it

- `npm run eval:fill:live` runs the golden set on the real model. Keep every document in `tests/ask/evals/fill/fixtures`
  synthetic, and regenerate them with `make-fixtures.mjs`.
- `e2e/ask-fill.spec.ts` needs S3 or MinIO, because an upload goes through storage. In a worktree, start a MinIO of your
  own and set `S3_ENDPOINT` on the server, not in `.env.local`.
- On demo data every `pre-15` is done or locked, so the spec removes that slice from Kestrel and restores it afterwards.
  A run killed half-way leaves it removed, and running the spec again does not bring it back: run
  `npm run db:seed-demo`.
- A composer ignores typing until it hydrates. Retrying "type and click Send" sends the message twice, so retry the
  typing and click once.
- `next dev` stopped twice during these runs with exit code 143, right after compiling a changeset route. Run the spec
  against a build with `next start`. Playwright otherwise tries `npm run dev`, which runs Docker Compose from the
  worktree and hits the main checkout's container names.
- The drop's golden set (`DROP_CASES` in `tests/ask/evals/fill/cases.ts`) runs the whole drop job in
  `drop-golden.test.ts`, with repositories, storage and the model in memory and the real reader, sorting, data router
  and action previews. Its fixtures are the `drop-*` files; `make-fixtures.mjs` now writes only missing files unless
  given `--force`, and takes `CHROMIUM_PATH` when the installed Chromium is not the version Playwright expects.
- The drop's end-to-end test (last in `e2e/ask-fill.spec.ts`) drops a folder for Kestrel and Solstice through the
  folder picker (`ask-folder-input`), so it needs a Playwright that uploads directories (1.46 or later). It names the
  state in the folder, because the demo data has no labour batch and may have no registered office state. It deletes
  the August batches it opened.
