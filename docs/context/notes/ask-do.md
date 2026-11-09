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

## Rows and approval

- `gate`, `owner` and `condition` hold a row. `format`, `answer` and `validator` wait for an edit. `conflict`,
  `other_step` and `documents_differ` allow Accept, but "Accept all clear rows" leaves them for their own click.
- A row whose condition parent is empty gets a question row first. Answering it rechecks in order and releases its
  children, so a resident question can free the PAN row below it.
- The approval is an atomic claim on status, hash and expiry. Every row is checked again at the click by
  `src/lib/actions/checklist/rules.ts`, and it writes through `checklistPatchForRole`, the same code the screen uses.
- The field catalog is generated: run `npm run ask:catalog` after changing a source, or `catalog.test.ts` fails.

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

## Agent runs (phase 5)

- The API takes at most 20 strict tools in one request and counts deferred ones, so only the loaded common tools are
  strict. Zod parses every input again at execution, so a deferred tool loses nothing that matters. Strict schemas take
  no `minLength`, `pattern` or `format`; `agent/tools.ts` strips them and zod keeps those rules.
- `z.toJSONSchema` needs the default `output` side: the `input` side leaves out `additionalProperties: false` and the
  API answers 400.
- Tool names cannot hold a dot. `tasks.create` travels as `tasks__create`.
- `maskJson` over a run's transcript must leave thinking blocks alone, or the API refuses the next turn. It walks the
  value now instead of masking the JSON text.
- A UUID can hold a shape that reads as a passport or an Aadhaar, so `maskIdentityNumbers` skips whole UUIDs. Without
  that, a run's tool ids break when they come back from storage.
- `step.waitForEvent` does not see an event sent before the wait began. The job's first wait is one minute and it looks
  at the card after every wait, so a very fast click still wakes the run.
- Action areas load one at a time. The schema files import each other, and loading them in parallel could read one half
  evaluated in a test run.
- `refusing()` turns a repository's 4xx into a sentence. Anything else stays a fault, so the loop reports a neutral line
  to the model and the real error goes to the log.
- A script under `node --conditions=react-server` (the `eval:*:live` scripts) must never reach `react-hot-toast`.
  `BoardResolutionSaveError` lives in `src/lib/api/board-resolution-errors.ts` for that reason, and its test fails if
  that module loads the toast library. The operations eval still runs under vitest with `// @vitest-environment node`.
- `e2e/ask-run.spec.ts` needs `ASK_E2E_LIVE=1`, a build under `next start` with `INNGEST_DEV=1`, and
  `npx inngest-cli@latest dev -u http://localhost:3100/api/inngest --no-discovery`. Start the server with
  `RESEND_API_KEY= WHATSAPP_ENABLED=false WATCH_ENABLED=false`, because the dev server also fires the crons.
- The injection test removes the first test's note first. That note truly says two requests are open, so with it present
  the run rightly proposed a reminder card, which reads like a failed injection test and is not one.
- An action marked `firmWide` sits on no project. A request for one skips the client lock, and a run with no lock is shown
  only firm-wide tools, so it cannot reach a project action. Only receivables are firm-wide so far.
- `tests/ask/evals/ops-cards.test.ts` needs a throwaway copy named `*_eval`, because it changes demo rows freely, then
  `DATABASE_URL=...<name>_eval ASK_EVAL_OPS=1 npx vitest run tests/ask/evals/ops-cards.test.ts`. The copy needs a held board
  meeting and a labour batch that is not attested, which `npm run db:seed-demo` does not make. The `vcfo_pack_ops` database
  that had them was dropped with its worktree on 9 November, so make them in the app first. A plain demo copy fails three tests.
  Add `ASK_EVAL_LIVE=1` for the model runs. Generated registers are cached in the database, so a rerun on the same copy
  builds nothing new and its check on new files fails; make a fresh copy.

## Client actions (phase 7)

- The portal has its own chat window, `client-portal/AskLauncher.tsx`, as well as the full page. It sends a question to
  `/api/client/portal/answer` first and copies Ask VCFO's answer into its own log, so a card, a run and the attach button
  all had to be added there. A file or a message with a line break skips the overview route, so a paste stays out of it.
- Anything from Tailwind inside the portal sits in a `.cp-tw` island, or its buttons and lists render as bare browser
  defaults. The card's wrapper carries `vpc-work cp-tw`. The chat's own form rules are `#vp-chat>form`, so that they do
  not restyle the edit form inside a card.
- A row's own "Saved" label is always on the card, so a browser test waits for the Undo button, not for the word.
- "Name:" alone is not a catalog label, so `Name: Ravi` is not data and goes to the plain line. `Name` with `PAN` is. With
  no model key the plain line answers that the chat is unavailable, which reads like a failed lock and is not one.
- A director's PAN stays held until "Resident of India?" is answered, for a client as for staff. That is the screen's own
  condition.
- `e2e/ask-client.spec.ts` runs on a build under `next start`, with a MinIO of your own and `S3_ENDPOINT` on the server.
  It needs no model key and no job server.
- `e2e/ask-fill.spec.ts` and `e2e/ask-client.spec.ts` both take Kestrel's `pre-15` step and put it back. On two
  Playwright workers they wait for each other through `lockDemoProject` in `e2e/helpers/login.ts`, a Postgres advisory
  lock held for the whole file.
- The vault smoke pages read files from MinIO at `engagement-documents/<object_key>`. A fresh MinIO has none, so those
  pages answer 404 until the demo files are uploaded there; that is the environment, not the code.
- `e2e/ask-ops.spec.ts` switches the receivables sheet's reminders on for its reminder test and puts the rules back,
  because a seeded sheet sends none. The hourly sender skips a sheet whose reminders are off.
- `tests/ask/evals/ops-cards.test.ts` takes reminders from today's queue, not from any queued row, so a demo copy seeded
  on an earlier day still works. Its paysheet carries `minimumWageCoverage`, because the labour close blocks while any
  employee's coverage is undecided.
- An agent run's row in `ask_runs` adds the Haiku pick call to the Sonnet turns, while `ask_usage_daily` keeps one row per
  model. Price a run from the daily table or from its `model` steps, not from the run row's model name.
