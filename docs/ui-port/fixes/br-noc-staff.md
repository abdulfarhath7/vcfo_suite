# Board resolution (NOC): data and staff page (30 Oct 2026)

Branch `feat/br-noc`. Scope after the split: item 4 (data) and item 2 (staff T1 to T6). The client
page (item 1) and the shared document part (item 3) are reported in `br-noc-client.md` and
`br-noc-doc.md`. Contract for the other agents: `docs/ui-port/BR-NOC-API.md`.

## Spec items

| Item | Status | What I did |
|---|---|---|
| T1 Same page as the client | Done (staff parts) | Staff head now reads "Board resolution (NOC)", the variant as subtitle, and "Passed by: Board of {parent} (the parent) · {company} · Phase 1 · Steps 2–3". The shared `DocTrack` strip shows 6 steps (foreign) or 4 (Indian). The "Why VCFO chose this template" card uses the shared `EvidenceTable` with `nocEvidence()` on the real answers. The existing editor, Stage list, approve and send-back, Send to client and staff upload all stay. |
| T2 Template card | Done | Variant label, internal file name, version tag, "Change template" (manager, admin, super admin) in a dialog with a required reason; the route writes `board_resolution.template_changed` with from, to and the reason; the card shows the change line (who, date, reason). Generation and the template status route honour the override. Also the D1 switch "Notary and apostille steps" (foreign parent only). |
| T3 Out of date | Done | Each fresh render records a version snapshot of the merge values from the answers. After release, when today's answers differ from the latest version, the card shows the chip "Answers changed after release", the changed values, and "Make the draft again" (the existing generate with `forceTemplateRefresh`, which also records the new version). |
| T4 Versions | Done | `GET .../board-resolution/versions` and "Compare versions" in a dialog with the shared `VersionCompare`. Inline-edit saves are not versions; an unchanged re-render adds none. |
| T5 Receive checklist | Done | Shared `ReceiveChecklist`, shown in the main column once a signed copy exists. Six checks (foreign) or four (Indian, or notary steps off). Accept is refused by the server too until every check is ticked. Send back needs a reason (server and UI) and notifies the client (`review_rejected` on pre-3 with the reason). Every tick, Accept and Send back writes an audit line. Ticking "Notary stamp" stamps Notarised; "Apostille certificate" stamps Apostilled. |
| T6 After Accept | Partly | The signed copy is indexed as a Vault document (step pre-3, category "Board resolution", shared with the client); the vault de-duplicates by object key. Gap: there is no SPICe+ attachment list in the code yet, so nothing is added there. |
| Data: step states and ticks | Done | Additive columns on `engagement_board_resolutions` and a new versions table (below), written only through `src/db/repositories/board-resolution-noc.ts`, each function scoped by `getEngagementById`. A new signed upload clears the ticks, the notary and apostille stamps and the send back. |
| Received counts as Accepted | Done (backfill) | A one-off SQL backfill for the hub to run with the migration (in `BR-NOC-API.md`). After it the only rule is `accepted_at IS NOT NULL`. |
| Tests (section 7, staff and data) | Done | See below. |
| Smoke | Done | `e2e/smoke.spec.ts`: the board resolution route for super, admin, manager and lead with a `staffBoardResolution` check (head, Template card, evidence, Compare versions dialog). The client entry was added by the client agent. |

## Files

Created:
- `src/lib/noc/receive.ts`: track keys, receive checks, decision path, template override helpers.
- `src/lib/noc/fields.ts`: merge-value labels, version snapshot, diff.
- `src/lib/noc/state.ts`: `NocState` type and the pure builder, `nocMayAccept`.
- `src/lib/noc/__tests__/receive.test.ts`, `src/lib/noc/__tests__/state.test.ts`.
- `src/db/repositories/board-resolution-noc.ts`: get state, tick, accept (Vault), send back, change template, notary steps, versions.
- `src/db/repositories/board-resolution-noc.test.ts`: cross-tenant and role tests (25).
- `app/api/engagements/[id]/board-resolution/noc/route.ts`: GET state, POST staff actions.
- `app/api/engagements/[id]/board-resolution/versions/route.ts`: GET versions.
- `src/views/intern/board-resolution-noc/useNocState.ts`, `NocStaffCards.tsx`, `NocStaffCards.test.tsx`.
- `docs/ui-port/BR-NOC-API.md`, this report.

Changed:
- `src/db/schema.ts`: additive columns and the versions table.
- `src/db/repositories/board-resolution.ts`: a new signed upload resets the receive state.
- `app/api/engagements/[id]/board-resolution/generate/route.ts`: honours the template override; records a version.
- `app/api/engagements/[id]/board-resolution/status/route.ts`: template info follows the override.
- `src/views/intern/BoardResolutionEditorView.tsx`: head, track strip, receive card, Template card, evidence card.
- `e2e/smoke.spec.ts`: staff board resolution entries.

## Routes

- `GET /api/engagements/:id/board-resolution/noc` (client and staff; the client gets no `staff` block and never the file name).
- `POST /api/engagements/:id/board-resolution/noc` (staff): `check`, `accept`, `send_back`, `change_template`, `notary_steps`.
- `GET /api/engagements/:id/board-resolution/versions` (staff).
- Staff pages (unchanged paths): `/app/intern/engagements/[id]/board-resolution`, `/app/manager/projects/[slug]/board-resolution`, `/app/admin/projects/[slug]/board-resolution`, `/app/super/projects/[id]/board-resolution`.

## Schema added (no migration written, none run)

`engagement_board_resolutions`: `notarised_at`, `notarised_by`, `apostilled_at`, `apostilled_by`,
`accepted_at`, `accepted_by`, `sent_back_at`, `sent_back_by`, `sent_back_reason`,
`receive_checks jsonb not null default '{}'`, `notary_steps_off boolean not null default false`,
`template_variant`, `template_changed_at`, `template_changed_by`, `template_change_reason`,
`vault_document_id uuid` (the `*_by` columns reference `profiles` on delete set null).

New table `engagement_board_resolution_versions` (`id`, `engagement_id` cascade, `version`, `variant`,
`fields jsonb`, `created_by`, `created_at`; unique `(engagement_id, version)`).

The migration must be applied before this code meets a database: every `select()` on the board
resolution table now reads the new columns.

## Backfill

A backfill, not a read rule: a read rule would also mark every new client submit of pre-3 as
accepted and make the receive checklist pointless. The SQL is in `docs/ui-port/BR-NOC-API.md`
("Backfill"); it sets `accepted_at` (and `accepted_by` when the reviewer is a profile) for rows with
a signed copy whose pre-3 is accepted.

## Checks

- `npx tsc --noEmit -p .`: clean.
- `npx eslint` on every file above: 0 errors, 0 warnings.
- `npx vitest run src/views/intern src/lib/noc src/db/repositories/board-resolution src/lib/api/board-resolution`: 10 files, 118 tests pass.

## Decisions

- Notarised and Apostilled are stamped by staff when they tick the matching receive check, not by the client: the client's only action is the upload, and SBC is the one that confirms the stamp and the certificate. One record holds every date (P2).
- Every staff role (lead included) may tick, Accept and Send back: the checklist says pre-4's lead "reviews the signed board resolution". Change template and the notary switch are for manager, admin and super admin.
- "Make the draft again" is the existing regenerate (with `forceTemplateRefresh`), which on a released document is the existing repair path; it keeps the inline merge overrides, as the existing regenerate button does.
- The template override works by replacing the three ownership answers on the engagement passed to generation (`withNocVariantOverride`), so the docx generators are untouched.
- The out-of-date snapshot leaves out the three date values when Pre-1 has no resolution date, because the generator fills them with today and they would mark every draft out of date.
- The existing Stage list in the aside stays (it carries approve, send back, send to client and staff upload); the shared track strip sits above the two columns. The receive card goes in the main column above the editor so it is in view when a copy arrives; the Template card and the evidence sit under the two columns so the Stage aside keeps its sticky position.
- Send back reuses the `review_rejected` event on pre-3 for the client's mail and bell (the bell title reads "Board resolution sent back" with the reason).

## Requests for the hub

- Write the migration from `src/db/schema.ts` and append the backfill SQL; apply on RDS before deploying.
- T6 SPICe+ attachment list: no such list exists yet; add the accepted copy there when it is built.
- The staff page does not draw the C8 tree itself (the client agent's tree lives in the client-portal folder under `.cp` CSS); if the hub wants the tree on staff pages too, move that tree into `src/components/board-doc/`.
