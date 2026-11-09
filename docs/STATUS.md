# Repository status

Last updated: 2026-11-09, at the final gate of the Ask VCFO build on branch `chatbot`.
`docs/context/STATE.md` remains the record of what is built and deployed; this file records
where the working tree stands and what a future session should clean up next.

## Branch

`chatbot` holds the whole Ask VCFO build: the Answer, Do and Watch engines, the VCFO Assist hand-off
and the overnight cards. `origin/main` is merged in with a merge commit. Everything is committed
locally, nothing is pushed, merged to `main` or deployed. The five track branches (`chatbot-answer`,
`chatbot-watch`, `chatbot-pack-compliance`, `chatbot-pack-ops`, `chatbot-pack-client`) were fully
merged into `chatbot`, and their worktrees, branches and local databases are removed.

## Before it is merged and deployed

- Read `docs/specs/ask-vcfo/DEPLOY-NOTES.md`. It covers migration `0050_ask_row_edited`, the `vector`
  extension check on RDS, the local `pgvector/pgvector:pg16` image, every flag's production default,
  and the checks before each optional engine is turned on.
- Inngest keys are not set on AWS, so agent runs and every cron wait on that.
- What is still open is listed at the end of `docs/specs/ask-vcfo/BUILD-PLAN.md`, under "Final gate, 9 November".

## Recommended deeper refactors (not done; in priority order)

1. **Done 2026-10-22: lint is a gate.** The 74 `jsx-a11y` errors are fixed (fake `href="#"`
   links became `LinkButton` in `src/components/client-portal/LinkButton.tsx`; clickable divs use
   `onActivate` from `src/components/client-portal/a11y.ts`). `npm run lint` exits 0; the 262
   warnings remain (175 are `react-refresh/only-export-components`). Not checked in a browser.

2. **Split `app/globals.css` (about 2,700 lines)** into the generated token block, the shell
   skins and the per-area utilities, and delete the deprecated alias names on 2026-11-30 as
   `docs/design/TOKENS.md` schedules. `tailwind.config.ts` loses the `gold`, `orange`,
   `accent-*`, `phase`, `role` and `super-gold` maps at the same time.
3. **Done 2026-10-22: generated CSS is no longer committed** (`predev`/`prebuild` run `npm run css:portal`). Original note: `src/components/client-portal/css/*` is produced by
   `scripts/cp-css.mjs` from `css-src/`; generating it in a `prebuild`/`predev` npm script and
   ignoring the folder removes 21 duplicate files from every diff (the current branch carries
   both copies of each change).
4. **Done 2026-10-22: `src/lib/` is grouped into folders.** The top level went from 184
   entries (173 files, 11 folders) to 40 (17 files, 23 folders): `checklist/`,
   `board-resolution/`, `incorporation/`, `projects/`, `documents/`, `knowledge-bank/`,
   `notifications/`, `intern/`, `client/`, `super/`, `audit/`, `shell/` are new, `filings.ts`
   joined `compliance/`, and the ten `use-*.ts` hooks moved to `src/hooks/`. Tests moved with
   their modules; file names are unchanged and imports were rewritten mechanically (commits
   `6d7bf71`, `1066f03`, `df26221`, `d1692d7`). `src/lib/README.md` has one line per folder.
   The knip findings were acted on in `e10d1a5` (unused exports 175 to 11, types 27 to 1; see
   `docs/refactor/knip-2026-10-22.md`), and the load-sensitive `doc-pack-parity` test was split
   per document in `b9a8491`. Gate after: 0 type errors, 0 lint errors (246 warnings), 1925
   tests. Next step: `tsconfig` has `strict: false`; turn on `strictNullChecks` folder by folder.
5. **Done 2026-10-22: role-scope bugs and cross-tenant tests.** The `compliance.ts` bug was
   already gone (`5b7c50b`). Seven hand-written role checks that dropped `super_admin` were
   moved to the `src/lib/auth.ts` helpers, with 58 new tests. Still open: cross-tenant tests for
   the portal repositories (`client-*`, `knowledge-bank`, `profiles`), and clients added through
   `engagement_clients` see no documents in the engagement-less document list.
   knip ran (report in `docs/refactor/knip-2026-10-22.md`).

6. **Shrink `docs/specs/client-pages/` further** once the portal is accepted by the owner:
   `diff-shots/` (525 WebP, 5.6MB) and `DIFF-REPORT.md` document a finished comparison and
   can follow the other artefacts into the archive; `BUILD-INVENTORY.md` (468KB) and
   `inventory/home.md` (597KB) are machine-generated inventories that belong in git history
   rather than the tree.
7. **Reconcile the three "what changed" files**: `QUESTIONS.md` at the repo root,
   `docs/specs/client-pages/DECISIONS.md` and `BUILD-REPORT.md` overlap. Keep one decision log
   under `docs/specs/client-pages/` and link it from `STATE.md`.

8. **Done 2026-10-22: the largest hand-written files are split** (branch `refactor/claude-ready`, no
   behavior change, one commit each; gate after every commit: 0 type errors, 0 lint errors, 1925
   tests). Each original path still imports the same names. Lines before -> after (largest new file):
   `useMilestoneResponseFormState.tsx` 1976 -> 261 (`milestone-form/`, 383) `36bb5c7`;
   `use-app-provider-value.ts` 1431 -> 250 (`app-provider/`, 330) `7d546e6`;
   `repositories/engagements.ts` 1268 -> `engagements/` folder (378) `474b03a`;
   `repositories/credentials.ts` 1104 -> `credentials/` folder (342) `1a0c260`;
   `CredentialsPage.tsx` 1184 -> 233 (`sheet-grid.tsx`, 468) `8567c9b`;
   `FirmPeople.tsx` 1159 -> 366 (`firm-people/`, 419) `3fbcdd7`;
   `CreateProjectFormSections.tsx` 1026 -> 298 (`CreateProjectEntitySection.tsx`, 284) `7919a5b`;
   `MobileHome.tsx` 980 -> 100 (`useMobileHome.tsx`, 387) `98c2004`;
   `AccountSettings.tsx` 974 -> 414 (`account/`, 277) `c0c15f0`.
   Views use a state hook plus `create*` / `render*` factories called in the same render, so the
   React tree is unchanged. CredentialsPage, FirmPeople, CreateProjectFormSections, MobileHome and
   AccountSettings have no component tests, so those five splits rest on typecheck and lint and
   were not checked in a browser.
