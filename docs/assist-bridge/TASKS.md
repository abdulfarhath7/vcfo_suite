# TASKS

Append-only. One entry per phase. Newest at the bottom.

## <date> — P<n> <phase name>
- Built:
- Files:
- Left out:
- Verification: `npm run typecheck && npm run test` pass / fail

---

## 2026-09-23 — P1 The mapping module, core sections
- Built: `buildAssistProfile(ctx: DocPackContext)` with `ASSIST_PROFILE_SCHEMA_VERSION = 1`.
  Small resolvers per group, each naming its step: company (pre-5 approved name,
  pre-1 proposed names / NIC / share capital), registered office (pre-14 via
  `resolveRegisteredOfficeResponses`, contact from pre-1), directors (pre-15 via
  `readProposedDirectors`, legacy slots included). Every MCA dropdown string lives in
  `vocabulary.ts`, checked against option text captured from the portal. Missing items
  reuse doc-pack's `RequiredInput`s and key naming (`company.registeredOffice`,
  `company.authorisedShareCapital`, `director.{n}.pan`, `directors.any`); an item with
  no `reason` is a blank Suite field the lead can fill, an item with a `reason` is one
  Suite cannot supply. Each director carries its stable Suite `id` beside `index` (Q1).
- Files: `src/lib/assist-profile/{types,vocabulary,build}.ts`,
  `src/lib/assist-profile/{build,vocabulary,parity}.test.ts`,
  `src/lib/assist-profile/__tests__/fixtures.ts`
- Left out: `subscribers[]` (no pre-16 resolver, see Q3); registered office line 1 /
  line 2 / PIN (Suite stores one address string, see Q4); father's name split, place of
  birth, nationality (not collected). All listed in `missing` with a reason.
- Verification: `npm run typecheck && npm run test` pass (133 files, 1133 tests)

## 2026-09-23 — P2 The remaining sections
- Built: `agile`, `moa`, `aoa` in `buildAssistProfile`. Suite supplies only the AGILE-PRO-S
  director count (from the same `readProposedDirectors` list as `directors[]`); `moa` and
  `aoa` are empty objects. Twelve grouped `missing` items (GSTIN, premises, business
  activity, signatory, ESIC, bank, declaration, MoA objects / liability / witness, AoA
  witness / subscriber places) carry `reason: 'Suite does not collect this yet'` at
  `pre-10` — the specification for what Suite should collect next. Notes tell the lead
  which e-form answers are theirs (declarations, GSTIN / lease, MoA / AoA table).
- Files: `src/lib/assist-profile/{build,types}.ts`, `src/lib/assist-profile/build.test.ts`
- Left out: no field added to `checklist_state` (Q2, Q5).
- Verification: `npm run typecheck && npm run test` pass (133 files, 1137 tests)

## 2026-09-23 — P3 Route and UI control
- Built: `loadAssistProfile` (copies `loadDocPack`: `requireAnyRole('admin','manager','intern')`
  — super admin passes as admin — then `getDocPackInputs`, whose repository enforces the
  client ban and assignment; its 403 / 404 are returned as-is). `GET
  /api/engagements/[id]/assist-profile` → `{ ok, schemaVersion, companyName, profile,
  missing, notes }`, `Cache-Control: no-store`, no other method. `useAssistProfile` query
  hook. `CopyForAssist` on Pre-4 and Pre-10 in the step form body under the doc-pack
  strip, staff shell only: outline button copies `profile` JSON and toasts; chip counts
  blank Suite fields (`bg-success-light` at zero, `bg-warning-light` otherwise); "Show
  details" lists blank fields as the doc-pack dashed links to `stepId` / `tabId`, then
  what Suite cannot supply with its reason, then the notes.
- Files: `src/lib/api/assist-profile.ts`, `app/api/engagements/[id]/assist-profile/route.ts`,
  `src/lib/assist-profile/paths.ts`, `src/hooks/use-assist-profile.ts`,
  `src/components/assist-profile/CopyForAssist.tsx`,
  `src/views/engagement/EngagementStepDetail.tsx` (+9 lines),
  tests `src/lib/api/assist-profile.test.ts`, `src/lib/assist-profile/purity.test.ts`,
  `src/components/assist-profile/CopyForAssist.test.tsx`
- Left out: the by-hand check (open a real engagement at Pre-4 and click) was not run —
  no browser session against a seeded database in this run. `docs/05-acceptance.md`
  "By hand" and "End to end" remain for the human.
- Verification: `npm run typecheck && npm run test` pass (136 files, 1151 tests);
  `npm run build` passes and lists `ƒ /api/engagements/[id]/assist-profile`.

## 2026-09-23 — Revised pack: no CORS (docs/06-no-cors.md)
- Built: nothing new in the route — it was already an ordinary staff-scoped GET with the
  session cookie. Added the revised `CLAUDE.md` (rule 8) and `docs/06-no-cors.md`, and a
  route test asserting no `Access-Control-*` header and no `OPTIONS` export. P1–P3 from
  the earlier entries stand; `docs/00–05` are unchanged in the revised pack.
- Files: `docs/assist-bridge/{CLAUDE.md,docs/06-no-cors.md}`, `src/lib/api/assist-profile.test.ts`
- Left out: no CORS headers, OPTIONS handler, token route, extension-origin env var or
  cookie `SameSite` change — by design.
- Verification: `npm run typecheck && npm run test` pass (136 files, 1152 tests)
