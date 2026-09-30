# Ask VCFO — gap-closing build context for Claude Code

Version 1.0 · 2026-09-30 · Companion to `docs/specs/ask-vcfo/ASK-VCFO-CONTEXT.md` (v2.0) and `CLAUDE.md`.
Place this file at `docs/specs/ask-vcfo/ASK-VCFO-GAPS-CONTEXT.md`.

## 0. Starting point (verified audit)

Audited at commit `1057011` (2026-09-30 20:07 IST):

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 160 files, 1,457 tests, all passing.
- `tests/ask`: 66 tests, all passing (mock provider).
- Ask VCFO is otherwise built as specified in v2.0, including go-there links and C1–C5 plus A1 behind flags.

This file closes the remaining gaps only. **Do not refactor, rename or restyle anything already built.**

| Id | Gap | Why it matters |
|---|---|---|
| GAP-1 | No `getPhaseProgress` tool and no "Where is my incorporation now?" answer | Most common client question; today the model improvises from the snapshot |
| GAP-2 | All 25 topics are `draft`; no tooling to review or publish them | Every client answer shows "Not yet reviewed" |
| GAP-3 | `npm run eval:live` has never been run | Real model behaviour is untested |
| GAP-4 | No end-to-end (browser) tests or screenshots for Ask VCFO | Nothing checks the panel actually works in the app |
| GAP-5 | `PHASE-0-RECON.md` says A1 is "deferred", but A1 is built behind a flag | The doc misleads future work |

Out of scope: pgvector/embeddings (deliberately omitted in v1), repo visibility, AWS flag changes (owner actions, §7).

## 1. Rules for every phase

All hard rules in `ASK-VCFO-CONTEXT.md` §0.3 still apply. The critical ones:

1. Only `src/db/repositories/*` imports `db`. New tools call repositories or existing pure libs with the caller's `AuthContext`.
2. Ask VCFO stays **read-only**. No sends, submits, approvals or uploads.
3. Never read board-resolution content in Ask VCFO tools.
4. Do not edit `src/data/checklist.ts`, step validators, docx generators, `src/lib/checklist-step-gate.ts`, compliance math, the email dispatcher, or BR finalize.
5. Never use "Assist" in new names. VCFO Assist is the separate Chrome extension (`src/lib/assist-profile/`).
6. **Never publish a topic automatically.** Only a named human reviewer publishes.
7. Tokens, not hex. Light and dark mode both.

**Verification gate after every phase:**
```
npx tsc --noEmit > /tmp/tc.log 2>&1; grep -c "error TS" /tmp/tc.log   # must print 0
npx vitest run --reporter=dot
npm run lint
```

**Preservation list:** every existing file under `src/lib/ask`, `src/components/ask`, `src/data/ask`, `app/api/ask` except the exact edits listed below; `src/lib/client-overview.ts` (`buildProgress`), `getIncorporationPhases`, `gateActiveCatalog`, `AskShellMount`, `route-guard.ts`, `destinations.ts` behaviour.

---

## 2. GAP-1 — Phase progress ("Where is my incorporation now?")

### 2.1 Pure function
New file `src/lib/ask/phase-progress.ts`:

```ts
export interface PhaseProgressRow {
  id: string;                 // incorporation phase id, e.g. 'pre-inc-phase-1'
  name: AskPhase;             // 'SPICe+ Part A' | 'SPICe+ Part B' | 'Post-incorporation' | 'Registration'
  done: number;               // terminal steps in this phase (completed or not-applicable)
  total: number;              // active steps in this phase
  state: 'done' | 'current' | 'upcoming';
  currentStep?: { id: string; title: string; owner: 'client' | 'lead'; locked: boolean };
}
export function buildPhaseProgress(input: SnapshotInputLike): PhaseProgressRow[];
```

- Build from `getIncorporationPhases()` and the same gate/state inputs `snapshot-build.ts` already uses (`gateActiveCatalog`, `getStepGate`). Reuse; do not duplicate gate logic.
- Use each phase's **itemIds order**, not `order`. Exclude legacy `reg-2`. Keep "Operational Readiness" out, as in the main UX.
- The phase containing the current step is `current`; earlier phases with every active step terminal are `done`; the rest are `upcoming`.
- Put `PHASE_BY_ID` in one shared place: export it from `snapshot-build.ts` or move it to this file and import it back. One source only.
- Return no ids beyond step/phase ids, and no people, dates or document data.

### 2.2 Tools
- `CLIENT_TOOLS.getPhaseProgress`: no input; scoped to the client's engagement (same context as `getProjectSnapshot`).
- `STAFF_TOOLS.getPhaseProgress`: input `{ engagementId: string }`. Must go through the same firm/engagement scoping as `getProjectSummary`. Returns 403-equivalent tool error when out of scope.
- Both definitions: `strict: true`, `additionalProperties: false`, like the existing tools.
- Add the tool name to whatever citation allowlist `validate.ts` uses for tool citations.

### 2.3 Deterministic suggestion
- Schema (`src/data/ask/schema.ts`): add handler kind `{ kind: 'phaseProgress' }` to the suggestion `handler` discriminated union.
- `src/data/ask/suggestions.ts`: add, **as the second client suggestion** (after "What is my next step?"):
  `{ id: 'client-where-now', shell: 'client', group: 'About your project', label: 'Where is my incorporation now?', handler: { kind: 'phaseProgress' } }`
- `src/lib/ask/suggestions.ts`: add `phaseProgressAnswer(snapshot, rows)` returning an `AnswerEnvelope`:
  - `origin: 'deterministic'`
  - `line` (template): `"{done} of {total} steps are complete. You're in {currentPhaseName}, on {currentStep.title}."`. If no current step: `"All incorporation steps are complete."`
  - `visual`: `{ type: 'flow', stages: rows.map(r => ({ label: r.name, sub: `${r.done} of ${r.total}`, state: r.state === 'current' ? 'here' : r.state === 'done' ? 'done' : 'next' })) }`
  - `why`: `"Each phase unlocks the next, so this is the step that moves your company forward."`
  - `links` (max 2):
    1. primary `{ to: 'incorporation', focusStepId: currentStep.id }`, label "Open Incorporation"
    2. only if `currentStep.owner === 'client'` and not locked: `{ to: 'step', stepId, section: 'upload' | 'form' }`, label "Open {step title}". Use `upload` only when the step has an upload section; otherwise `form`.
  - `citations`: `[{ id: 'getPhaseProgress', label: 'Your project' }]`
  - All links pass `checkDestination` (locked steps already fall back to the flowchart).
- Staff: in the admin/super **project summary** deterministic answer (if one exists) and in `getProjectSummary` results, no change is required. Do not add a staff suggestion.

### 2.4 Model path
- Guard intent `project_status` for a client should make `getPhaseProgress` available to the answer model. Add one line to the client persona prompt in `generate.ts`: "For questions about overall progress, call getPhaseProgress."
- A free-text "where are we?" that the guard maps to this intent may be answered by the deterministic `phaseProgressAnswer` directly (no Sonnet call), the same way `nextStep` is short-circuited, if `shortcut.ts` supports it. Otherwise leave it to the model.

### 2.5 Tests (`src/lib/ask/__tests__/phase-progress.test.ts`)
- Fresh engagement: Part A `current`, others `upcoming`; counts match active items.
- Part A all terminal, current step in Part B: A `done`, B `current`.
- `not-applicable` counts as done; `reg-2` never appears; phase order follows itemIds.
- LLP / partnership engagements: rows still follow the active catalog for that engagement; no SPICe+ wording is invented beyond phase names from `getIncorporationPhases()` (flag in the report if phase names are SPICe+-specific for LLPs; do not change them without the owner).
- Client tool cannot read another engagement; staff tool rejects out-of-scope engagement ids.
- `phaseProgressAnswer`: link 2 absent when the current step is lead-owned or locked; primary link focuses the current step.
- Suggestion `client-where-now` returns with zero provider calls (assert mock provider not called).
- Add 3 golden eval cases (mock + `live` block) to `tests/ask/evals/golden.ts`: "Where is my incorporation now?", "how far along are we", "what phase are we in".

Commit: `feat(ask-vcfo): phase progress tool and where-now answer`

---

## 3. GAP-2 — Topic review and publish tooling

The firm reviews content; the code makes review fast and safe. **Nothing here publishes on its own.**

### 3.1 Review pack
New script `scripts/ask-topics-report.ts`, npm script `"ask:topics:report": "node --conditions=react-server --import tsx scripts/ask-topics-report.ts"`.

Writes `docs/specs/ask-vcfo/TOPIC-REVIEW.md`, regenerated on every run:
- Summary table: slug · title · category · audience · status · version · reviewedBy · reviewedAt · used by (suggestion ids, step ids, document types, obligation codes).
- Then one section per **draft** topic: question; `normal`, `simple`, `detail`, `why` text; visual described in words (use the existing `visual-text.ts` helper); citations with URLs; related slugs; `appliesTo`; and a checklist for the reviewer:
  `- [ ] Facts correct  - [ ] Plain English  - [ ] No decision stated as advice  - [ ] Citations correct  - [ ] No amounts or dates that belong in the calendar`
- Sort: topics used by client suggestions first, then step topics, document topics (C2), obligation topics (C5), others.
- Also list **coverage gaps**: client-owned active steps, document types and obligation codes with no topic.

### 3.2 Publish command
New script `scripts/ask-topics-publish.ts`, npm script `"ask:topics:publish"`:

```
npm run ask:topics:publish -- <slug> --reviewer "Name, Role"
npm run ask:topics:publish -- --unpublish <slug>
```

- Refuses without `--reviewer` (non-empty, at least 3 characters).
- Sets `status: "published"`, `reviewedBy`, `reviewedAt` (today, ISO date, IST), and **bumps `version` by 1**.
- `--unpublish` sets `status: "draft"`, keeps reviewer history, bumps version.
- Validates the edited file with the zod topic schema before writing; writes with 2-space JSON and a trailing newline to keep diffs clean.
- Prints a one-line summary. Never touches more than the named topic.
- Topic content edits are done by hand in the JSON; this script only changes review fields and version.

### 3.3 Field help (C3)
`src/data/ask/field-help.ts` lines show only when reviewed. Add the same report section for field-help lines and a `--field <stepId>.<fieldKey>` mode to the publish script **only if** field-help entries already carry a review status. If they don't, add `reviewedBy?`/`reviewedAt?` to the field-help type, treat missing as unreviewed, and keep behaviour identical until reviewed.

### 3.4 Tests
- Publish refuses without reviewer; publish bumps version and sets fields; unpublish reverts status and bumps version; invalid topic JSON aborts without writing.
- Existing library "Updated" badge test still passes after a publish-driven version bump (add one case).

Commit: `feat(ask-vcfo): topic review pack and publish command`

---

## 4. GAP-3 — Live evaluation · CHECKPOINT

### 4.1 Before running
**Pause and ask the owner** to confirm:
1. An `ANTHROPIC_API_KEY` is set in `.env.local` (or Bedrock env), and
2. They accept the token cost of one run.

If no key is available, skip to Phase 5 and report "GAP-3 blocked: no key".

### 4.2 Run and record
- Extend `tests/ask/evals/run-live.ts` with `--out <path>`: write a markdown report with date, models used, provider, pass/fail per case, the guard intent seen vs expected, validation problems, and total input/output tokens.
- Run: `npm run eval:live -- --out docs/specs/ask-vcfo/EVAL-LIVE-2026-09-30.md` (use the actual date).

### 4.3 Fix failures
For each failure, fix the cause in this order, and re-run until all pass or three rounds are done:
1. Guard prompt (scope wording, intent examples).
2. Answer persona prompt / tool descriptions.
3. Golden case expectations, **only** if the expectation itself was wrong. Say so in the report.

**Never** loosen `validate.ts` (dates, citations, BR, links, schema) to make a case pass.

Commit: `test(ask-vcfo): first live eval run and prompt fixes`

---

## 5. GAP-4 — Browser tests and screenshots

### 5.1 Setup
- `playwright.config.ts`: add `env: { ASK_VCFO_ENABLED: 'true' }` to `webServer` (no API key needed: suggestions are deterministic). Add a project for mobile (`devices['Pixel 7']`) alongside chromium.
- Use seeded demo users from `CLAUDE-CONTEXT.md`. If the client demo engagement lacks a current client-owned step, use `npm run db:seed-demo` data; do not add new seed data unless required, and say so if you do.
- Shared login helper in `e2e/helpers/login.ts` (pattern from `intern-today-managers.spec.ts`).

### 5.2 `e2e/ask-vcfo.spec.ts`
Client (`client@vcfo.local`):
1. "Ask VCFO" launcher visible in the top bar; Ctrl+J opens the panel; Esc closes it.
2. Panel home shows "What is my next step?" and "Where is my incorporation now?".
3. Tap "Where is my incorporation now?": answer card renders a flow visual and the "Not yet reviewed" badge (topics are drafts).
4. Tap "Open Incorporation": URL is the Incorporation page; the focused element carrying `data-ask-focus` equal to the current step (or its phase row) gets `.ask-focus-pulse`; the `focus` query param is removed afterwards.
5. At 1280 px width the panel closed on navigation and "Back to Ask VCFO" is visible; clicking it reopens the same conversation.
6. Open a topic suggestion, tap "Save to library", go to Library: the item is listed.
7. Type "write me a python script": the off-topic refusal appears (requires no key: guard unavailable must still refuse or show the "unavailable" message; assert whichever the app shows without a key and note it).

Admin (`admin@vcfo.local`): launcher visible; "Which projects are waiting on clients?" renders rows; a row link opens a project page.

Super (`super@vcfo.local`): "Preview Ask VCFO as a client" opens the picker; choosing an engagement shows the client-view banner.

Manager and Project Lead (`manager@vcfo.local`, `intern@vcfo.local`): no launcher; `GET /api/ask/suggestions?shell=client` returns 403 via `page.request`.

Mobile project: client panel opens as a bottom sheet.

### 5.3 Screenshots for human review
`e2e/ask-vcfo-screens.spec.ts` captures (no pixel assertions) into `test-results/ask-vcfo/`:
client panel home and answer at 1440, 1280 and 390 wide, in light and dark (toggle the existing theme control); Library page; admin answer; super preview. Name files `{role}-{screen}-{width}-{theme}.png`.

### 5.4 Run
`npm run e2e -- e2e/ask-vcfo.spec.ts e2e/ask-vcfo-screens.spec.ts`. If the dev database is not available in this environment, write the tests, run the vitest gate, and report "e2e written, not run: {reason}".

Commit: `test(ask-vcfo): end-to-end flows and review screenshots`

---

## 6. GAP-5 — Documentation

- `docs/specs/ask-vcfo/PHASE-0-RECON.md`: replace the two "A1 … deferred / not built" statements with: "A1 (question gaps) is built behind `ASK_VCFO_FEATURE_A1` (off). Turning it on also shows the client visibility notice in the panel. The wording is the owner's to confirm before enabling."
- New `docs/specs/ask-vcfo/STATUS.md`: one table, every spec item → Built / Changed / Omitted, with file paths and the reason for each Changed/Omitted item (forced tool choice → auto; Ask my lead → tasks; no inbox → Home; no embedding column; A1 built, off). Add a "How to turn on" section: `.env.local` keys, Terraform `ask_vcfo_enabled` and `ask_vcfo_features`, secret `/vcfo/ask-vcfo/anthropic-api-key`.
- `docs/context/STATE.md`: one line pointing to `STATUS.md`.

Commit: `docs(ask-vcfo): status table and corrected recon notes`

---

## 7. Owner actions (not code — list them in the final report, do not attempt)

| Action | Why |
|---|---|
| Firm reviewers review `TOPIC-REVIEW.md` and publish with `npm run ask:topics:publish` | Removes "Not yet reviewed" badges |
| Put the Anthropic key in Secrets Manager at `/vcfo/ask-vcfo/anthropic-api-key` | Needed for AWS |
| Set Terraform `ask_vcfo_enabled = true` when ready; add feature ids to `ask_vcfo_features` | Both default off |
| Confirm the visibility notice wording before turning on A1 | Client privacy |
| Check GitHub repo visibility (it currently clones without login) | Intended to be private |

---

## 8. Order of work and final report

1. GAP-1 → gate → commit
2. GAP-2 → gate → commit
3. GAP-3 → **CHECKPOINT** (key and cost) → run → fix → commit
4. GAP-4 → gate (+ e2e if runnable) → commit
5. GAP-5 → commit

Final report (paste back to the owner):
- One table: GAP-1 … GAP-5 → Done / Blocked (reason) · files · tests added.
- Gate results: tsc errors count, vitest totals, lint result, e2e result.
- Live eval: pass count / total, tokens used, link to the report file.
- Anything that deviated from this file, and why.
