# Generated documents: incorporation drafts, document pack, board resolution

Gotchas already paid for once. Append when something costs more than a minute to figure out.

## Document pack (2026-09-22)

- Section tabs have no ids. The pack links to a tab by `sectionSlug(field.section)`
  (`src/lib/doc-pack/section-slug.ts`) and the step page reads `?tab=<slug>` in
  `useMilestoneResponseFormState`; an unknown slug leaves the first tab. Part A's
  tab set varies with `ownershipType`, so never store a tab index.
- Pack item keys are `{docId}:{audience}` — the same `doc:audience` row keys Pre-7
  uses for `sharedIncorpDraftDocs`, so `incorpDocRowKey` maps both ways. URL-encode
  the colon in links (`docPackItemUrl`).
- The generators render every director with a residency (up to six per kind);
  `evaluateDocPack` lists only directors without a residency, or past the ceiling,
  in `summary.skippedDirectors`.
- `src/lib/api/doc-pack.ts` imports the auth guard, so any test importing it must
  mock `@/auth/guards` and `@/db/repositories/doc-pack` (next-auth pulls `next/server`).
- `src/views/intern/useBoardResolutionEditorState.tsx` has a blank line after
  every line; keep that format when editing or the diff doubles in size.
- Pre-7 keeps writing `*DraftUrl` paths (its validator requires them). The pack
  reads them and serves the attached file when present; it never writes them.

## Per-director incorporation drafts (2026-09-23)

- **Audience keys and prefixes** (`src/lib/incorporation-docs/audiences.ts` is the
  only place that builds them): first non-resident `non-resident` / `nrDirector`,
  first resident `resident` / `residentDirector`, nth `non-resident-{n}` /
  `nrDirector{n}` and `resident-{n}` / `residentDirector{n}`. Slot numbering is per
  residency in list order, the same as `directorsAsPre6Responses`. Draft ids are
  `{prefix}{docSuffix}DraftUrl`, signed ids `{prefix}{docSuffix}SignedUrl`; company
  docs keep their fixed ids. Slot 1 ids, row keys and S3 paths are unchanged.
- **Pre-7 / pre-8 fields are a static superset.** `expandDirectorSlotFields` declares
  slots 2–6 after each slot-1 field; the form shows only the directors on file
  (`fieldsForDirectorAudiences`) and read-only lists hide later slots until they hold
  a value (`withoutUnusedDirectorSlots`, pre-7 / pre-8 only — pre-6 has its own
  `nrDirector2…` KYC fields). `extractItemResponses` keeps only declared ids, so a
  new per-director id must be declared or it is dropped on read.
- **Frozen slot set.** Once pre-7 is shared (`incorpDraftsSharedAt`) or accepted,
  slots that were not in the legacy set become optional (`isIncorpSlotSetFrozen`);
  pre-8 does the same once accepted. The two declarations are always optional.
- **Renumbering.** Removing or reordering a director renumbers the slots: the drafts
  and uploads stay under the old key (`resident-2` might now be a different person).
  Stable entry ids would fix it; not done. Regenerate after changing the list.
- **Applicability without data.** A doc with `appliesToDirector` (ID & address
  declaration — DIN holders only) is not laid out when no `pre6` map is passed;
  stored drafts still list through `ignoreAppliesTo`.
- **DIR-8 table** is a docxtemplater row loop (`PRIOR_DIRECTORSHIPS`); `renderDocx`
  takes array data only for declared loop keys. Templates are re-tagged by
  `scripts/incorp-docx-retag.mjs` and the declarations built by
  `scripts/incorp-docx-build-declarations.mjs` — both idempotent; edit the scripts,
  not the .docx by hand.
- `tsc --noEmit` is incremental here (`tsconfig.tsbuildinfo`); use
  `--incremental false` for a gate you trust — a stale build info once hid a test
  typing error.
- Pre-2 board resolution picks its template by NOC variant (`boardResolutionVariant`
  in `src/lib/board-resolution.ts`): foreign → `boardResolution.docx`, Indian
  investing / name use → `boardResolution-indian-*.docx`. Those are built from the
  firm's blank `noc-indian-*.docx` (kept as supplied) by
  `node scripts/prepare-noc-board-resolution-docx.mjs`; both prepare scripts share
  `scripts/docx-comment-tags.mjs`. Standalone or an unanswered Indian role falls
  back to the foreign template.
