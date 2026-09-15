# Claude Code prompt — entity-type intake, MCA-ordered Part A, manager date windows, compliance gating

Run phases sequentially. Verify after each phase. Do not queue.

---

## 0. Global rules (apply to every phase)

- Read `CLAUDE-CONTEXT.md` first. It is the source of truth for the catalog, roles, and guardrails.
- **Repository seam is sacred.** Views never import `db`. All data access goes through `src/db/repositories/*`, each taking `AuthContext` and filtering by role. New API route → new repository method, never a direct query in a view or route handler body.
- **Code role `intern` = UI label "Project Lead".** Never render the string "intern".
- **Do not invent MCA forms, checklist steps, or validation rules** beyond what is specified in this document. `src/data/checklist.ts` is ported, tested domain — edit only where a phase below explicitly names it.
- **Do not change email semantics.** Autosave never emails. Manager Accept still opens Graph compose. `reviewSource=lead_manager_request` fan-out is unchanged.
- **Do not weaken the client sequential gate** (`src/lib/checklist-step-gate.ts`). Reordering tabs inside a step is not the same as reordering gated steps — see Phase 4.
- **Do not show board-resolution drafts to clients.**
- Keep status colour on chips and icons only. Never page fill.
- **Verification gate after every phase**, all three, and report the real numbers rather than asserting clean:
  ```
  npx tsc --noEmit > /tmp/tc.log 2>&1 && grep -c "error TS" /tmp/tc.log
  npx vitest run --reporter=dot
  npm run lint
  ```
  If a pre-existing failure is present before your change, say so explicitly instead of absorbing it.
- Commit at each phase checkpoint with the message given in that phase.
- Do not stop for permission between phases **except** at the two checkpoints marked **PAUSE**.

---

## 1. Change summary

| # | Change | Roles affected | Net-new schema? |
|---|---|---|---|
| CR-1 | Foreign entity details + proof captured at project creation for dependent entities only | Admin, Manager, Client, Lead | Yes |
| CR-2 | Independent entities: the Signatory KYC section is not shown at all in SPICe+ Part A | Client, Lead | No |
| CR-3 | NIC code (6-digit) asked in Business description, both entity types | Client, Lead | No |
| CR-4 | Part A section tabs reordered to MCA portal order; Business description moves ahead of Signatory KYC; NIC field sits directly below business description | Client, Lead | No |
| CR-5 | Manager sets from/to date windows: SPICe+ Part A & Part B, then per registration, then per compliance | Manager, Admin, Lead | Yes |
| CR-6 | Lead sees no compliances until incorporation is complete; only current incorporation tasks | Lead | No |

---

## Phase 0 — Discovery **(PAUSE)**

Do not write code. Read the repo and produce a mapping table covering:

1. Where entity type lives today. `CreateProjectForm` has a domestic/foreign toggle and parent/subsidiary fields. Report the exact field names, the DB columns on `engagements`, and whether "dependent / independent" maps onto the existing foreign/domestic flag or needs a new field.
2. Where foreign entity details and foreign entity proof are captured today — which step id, which section, which keys inside `engagements.checklist_state`, and how the proof file is stored (S3 key in responses, or a row in the documents/vault table).
3. The Part A step whose section tabs include Signatory KYC, Proposed company names, and Business description — step id, the tab config structure, and the file that defines tab order.
4. Every passport / driving licence field in signatory KYC: field ids, which validator enforces them, and whether any downstream docx generator (DIR-2, INC-9, MOA/AOA) reads them.
5. Existing date / SLA logic: the working-days SLA the intern step currently hides, the overdue computation, and where compliance instance due dates are set by the Inngest job.
6. The lead's Compliance nav entry and the Today queue query — how tasks are selected, and whether compliance items can currently appear there.

Output the table. **Stop. Wait for the owner to confirm the mapping and answer §8 open questions before Phase 1.**

Commit: `chore: discovery report for entity-type and scheduling CRs`

---

## Phase 1 — Entity type drives foreign entity capture

**Goal.** Foreign entity details and foreign entity proof are collected in the project creation form when the entity is dependent, and are not asked anywhere when it is independent.

**Rules.**
- Add a single canonical field on `engagements` — `entity_dependency` with values `independent | dependent` — unless Phase 0 shows an existing field that already carries exactly this meaning, in which case reuse it and say so.
- Dependent → the creation form shows a "Foreign parent entity" section: the same fields currently asked inside Part A, plus the proof upload. Independent → the section is not rendered, and the fields are not persisted as empty strings.
- **The creation form draft persists in localStorage. Files do not.** Upload the proof to S3 via a presigned URL as soon as the user picks it, and keep only the returned object key in the draft. Do not switch the POST to multipart and do not hold a File object in draft state.
- Storage: one `foreign_entity` jsonb column on `engagements` plus the proof key, or a repository-owned child table — choose one, justify it in the commit body, and put the accessor behind a single repository method.
- **Backfill is read-side, not destructive.** Existing engagements have this data inside `checklist_state`. Write one accessor that returns the new column and falls back to the legacy `checklist_state` path. Do not run a migration that deletes the legacy responses.
- Part A: the foreign entity fields are removed from the step for both types — dependent because the data now arrives at creation, independent because it never applied. If the step would become empty, do not delete the step; render it with the remaining fields.
- Where a lead or client needs to *see* the foreign entity details, show them read-only on the engagement overview, sourced from the accessor.

**Do not break.**
- Subsidiary/parent fields must still be collected when the start stage is Registration or Compliance. This is an existing bug guard — do not regress it.
- Admin POST `/api/engagements` still requires `managerId`; manager POST still forces self.
- Welcome email and client profile creation on POST are unchanged.

**Acceptance.**
- Creating an independent engagement produces no foreign entity keys in the payload or the row.
- Creating a dependent engagement stores details + proof key before the client ever logs in.
- An engagement created before this change still renders its foreign entity details through the accessor.
- Cross-tenant test: a lead on engagement A cannot read engagement B's foreign entity row.

Commit: `feat(engagements): capture foreign entity at creation for dependent entities`

---

## Phase 2 — Signatory KYC section shown only for dependent entities

**Goal.** In SPICe+ Part A, the entire Signatory KYC section is absent for independent entities and unchanged for dependent ones. This is the whole tab, not a subset of its fields.

**Rules.**
- Put the decision in one pure helper — `partAsectionsFor(entityDependency)` — returning the visible section list. The tab strip, the validator, the completeness check, and any generator all read from that one function.
- Independent → the Signatory KYC tab is not rendered, its fields are not validated, and its absence does not count against step completion. Dependent → identical to today.
- **Step completion must be computed from the visible section list, not a fixed count.** If completion is hardcoded to "all N sections done", an independent engagement can never finish Part A. Verify this in Phase 0 and fix it here.
- **Do not delete saved responses.** An engagement already holding signatory KYC data keeps it in `checklist_state`; the section is hidden, not purged. If entity type is ever corrected from dependent to independent, the data stays dormant and reappears if it is corrected back.
- **Check what reads this data before hiding it.** Phase 0 item 4 covers the docx generators (DIR-2, INC-9, MOA/AOA). If any generator or downstream step reads Part A signatory fields, the independent path must have a defined source for that data — most likely Part B step 6, Director KYC, which is a separate client step. Report what you find; do not emit empty placeholders into a generated document.
- The sequential gate between steps is untouched. Hiding a section inside a step is not unlocking anything.

**Acceptance.** Independent engagement: Part A renders without the Signatory KYC tab and reaches completed state through the remaining sections. Dependent engagement: byte-identical behaviour to before this change. An engagement with pre-existing signatory responses still has them in `checklist_state` after the change. No validator error fires on a section that is not rendered.

Commit: `feat(spice-a): show signatory KYC section only for dependent entities`

---

## Phase 3 — NIC code in business description

**Goal.** Both entity types are asked for a NIC code in the Business description section of SPICe+ Part A.

**Rules.**
- New field `nicCode`, rendered **directly below the business description free-text field**, in the same section.
- 6-digit numeric. Validate length and digits-only, with inline copy naming what it is: "6-digit NIC code filed with SPICe+".
- Store in the existing step responses inside `checklist_state`. No new table.
- Surface the value read-only wherever the lead reviews Part A before filing.
- Do not ship a NIC master list or autocomplete in this phase — see §8, question 3.

**Acceptance.** 5-digit and 7-digit input rejected inline. Value persists through autosave and reload. Appears on the lead's review of the step.

Commit: `feat(spice-a): add 6-digit NIC code to business description`

---

## Phase 4 — Part A section tabs in MCA portal order

**Goal.** The section tabs inside SPICe+ Part A follow the order the MCA portal uses, with Business description ahead of Signatory KYC.

**Rules.**
- Target order: **Business description (incl. NIC code) → Proposed company names → Signatory KYC → remaining sections → Submit.** Confirm the exact MCA Part A field sequence against the portal before committing the order; do not reorder from memory alone. If the portal order differs from the line above, follow the portal and flag the difference.
- **Submit stays the last tab.** The sticky footer and the "last tab = Submit" behaviour are load-bearing, and must resolve Submit as "last visible section", not "index N".
- **The order applies to the visible sections only.** After Phase 2, Signatory KYC is present for dependent entities and absent for independent ones. The order is defined once, in `partAsectionsFor`, and the tab strip renders whatever that returns — never two hardcoded orders.
- This is a *tab* reorder inside one step. It must not change: step order in the catalog, the `itemIds` phase ordering used by the overview, or the sequential gate between steps.
- Any code that indexes tabs by position rather than by id must be converted to id-based lookup as part of this phase. Position-indexed tab logic is how a reorder silently corrupts saved responses.
- Saved responses are keyed by field id, not tab index — verify this in Phase 0 and state it in the commit body. If any response is keyed by tab index, write the migration before reordering.

**Acceptance.** An in-progress Part A engagement created before the reorder opens with all previously entered values intact, in the new tab order. Autosave still patches `{ responses }` only and still sends no email.

Commit: `refactor(spice-a): order Part A section tabs to match MCA portal`

---

## Phase 5 — Manager-set date windows **(PAUSE before implementation)**

**Goal.** The manager sets a from/to window for the incorporation block, then for each registration, then for each compliance.

**Rules.**
- Three scopes, in this order of dependency:
  1. **Incorporation window** — one from/to covering SPICe+ Part A and Part B together (the owner's expectation is roughly a week). Confirm at the pause whether this is one window for both parts or one per part.
  2. **Per-registration windows** — from/to on each active registration step.
  3. **Per-compliance windows** — from/to on each compliance instance.
- Storage: scopes 1 and 2 are catalog steps, so store under a reserved key in `engagements.checklist_state` — `schedule: { [itemId]: { from, to, setBy, setAt } }` plus `schedule._incorporation`. **Do not create a table for these.** Scope 3 lives on compliance instance rows, which are separate — that needs nullable `window_from` / `window_to` columns and a migration.
- **Who can write:** manager and admin (and super admin). Lead, client: read-only. Enforce in the repository, not only in the UI.
- **Who can see:** lead sees the window on their Today rows and on the engagement phase rows. Client sees nothing new in this phase — see §8, question 5.
- **Reconcile with existing SLA.** The intern step page currently hides the computed working-days SLA. Do not reintroduce an SLA chip on the step page. Render the window as quiet mono metadata on Today rows and phase rows only.
- **Overdue stays on the current step only**, never on locked future steps. If the manager-set window makes a *locked* step technically overdue, do not badge it.
- Unset windows are normal, not an error state. No red, no "missing schedule" warning banner. An unset step simply shows no dates.
- A compliance instance generated by Inngest after the manager set a window must not have its manager-set dates overwritten by the job.

**Acceptance.** Manager sets an incorporation window; the lead sees it on Today without gaining an SLA chip on the step page. A lead PATCH to the schedule key is rejected at the repository. Re-running the Inngest compliance job does not clear a manager-set window. Cross-tenant test on the schedule accessor.

**Stop before implementing** and get the owner's answer on §8 questions 4, 5 and 6.

Commit: `feat(scheduling): manager-set date windows for incorporation, registrations and compliances`

---

## Phase 6 — Lead sees no compliances before incorporation

**Goal.** For a lead, compliances stay hidden until incorporation is complete; only current incorporation tasks show.

**Rules.**
- **Definition of "incorporation complete":** the Certificate of Incorporation step (Pre-12) is terminal — `completed` or `not-applicable`. Write this as one predicate, `isIncorporated(engagement)`, and use it everywhere. Do not inline the check in three components.
- **Edge case that must be handled:** engagements created with a start stage of Registration or Compliance never walk through Pre-12. Treat those as incorporated, or the lead never sees compliances at all. Decide from the start-stage field, not from step status alone.
- Scope of hiding:
  - **Today queue** — exclude compliance tasks for any engagement that is not incorporated. Incorporation steps for that engagement still show.
  - **Engagement overview** — no compliance section for a non-incorporated engagement.
  - **Compliance nav item** — hide only when the lead has *no* incorporated engagement. A lead with one incorporated client and one pre-COI client keeps the nav item, and the Compliance view itself lists only the incorporated engagements.
- Do not apply this gating to admin, manager, super admin, or client. It is lead-only.
- Removing the nav item must not leave a live route: `/app/intern/compliance` for a lead with zero incorporated engagements should redirect to Today, consistent with how `/tasks` already redirects.

**Acceptance.** A lead with only a pre-COI engagement sees no Compliance nav and no compliance rows on Today. The moment Pre-12 is marked complete, both appear without a re-login. Manager and admin compliance views are byte-identical to before.

Commit: `feat(lead): gate compliance visibility on incorporation completion`

---

## Phase 7 — Consolidation and docs

- Re-run the full verification gate.
- Update `CLAUDE-CONTEXT.md`: §3 (creation form now captures foreign entity), §4 (NIC field, Part A tab order), §5 (lead Compliance nav is conditional), and a new note on the schedule key in `checklist_state`.
- List every file touched, grouped by phase.
- Report anything you found that contradicts `CLAUDE-CONTEXT.md` rather than quietly conforming to the code.

Commit: `docs: update context for entity-type, NIC, tab order, scheduling and compliance gating`

---

## 8. Open questions — answer before Phase 1 and Phase 5

1. **Does "dependent" mean the existing foreign/domestic flag, the parent/subsidiary flag, or a third concept?** A foreign-owned subsidiary and a domestic subsidiary are different things, and the phrasing covers both. Phase 0 reports the current fields; the owner picks the mapping.
2. **Where does an independent engagement's signatory data come from once the Part A section is gone?** If Part B step 6 (Director KYC) already collects it, nothing is lost and Part A was duplicating work. If any Part A generator or filing step reads the Part A signatory fields directly, that path needs a source. Phase 0 item 4 answers this; confirm the intended substitute before Phase 2 ships.
3. **6-digit NIC code — confirm against the portal.** MCA name reservation commonly takes a 5-digit NIC 2008 code for the main division of industrial activity. If the firm genuinely files 6 digits, build 6 and note why. Also decide: free text with format validation now, or a NIC master list with search later.
4. **Incorporation window — one window for Part A and Part B together, or one for each?** "A week" suggests one combined window; per-part gives the lead a sharper signal.
5. **Does the client see any of these dates?** Showing a window on the client's Incorporation flowchart sets an expectation the firm may not want to commit to in writing. Default in this prompt is no.
6. **Do manager windows replace the existing working-days SLA, or sit alongside it?** Two competing deadline concepts in one product is the kind of thing that ends up contradicting itself on screen.
7. **Registrations are per-engagement and numerous.** Setting from/to on 23 registrations one at a time is a lot of clicks. Should Phase 5 include bulk assignment (select several, set one window), or is per-registration enough for the pilot?

---

## 9. Risks

- **Phase 4 is the highest-risk change to in-flight data.** If any saved response is keyed by tab position, reordering corrupts live engagements. The Phase 0 check is not optional.
- **Phase 1 changes who supplies foreign entity data** — it moves from the client (in the portal) to the firm (at creation). The firm must have those documents in hand before creating the project, or project creation becomes blocked work. Confirm the firm actually holds them at that point in the process.
- **Phase 2 removes a whole section, so step completion is the failure mode.** Any completeness check counting a fixed number of sections will leave independent engagements permanently stuck mid-step, and the lead will see it as a step that refuses to close.
- **Phase 5 reintroduces deadline pressure into a workspace deliberately kept quiet.** The intern step page was stripped of SLA chips on purpose; keep the dates on Today and phase rows.
- **Phase 6 hides a nav item.** Hidden nav is invisible to the lead, so if `isIncorporated` is wrong for start-stage-Registration engagements, the lead has no way to discover the missing feature and will report it as broken.
