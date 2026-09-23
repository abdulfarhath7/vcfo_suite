# 04 — Phases

Three phases, all in this repository. Roughly: P1 two to three hours, P2 two hours,
P3 one hour.

---

## P1 — The mapping module, core sections

`src/lib/assist-profile/types.ts`, `vocabulary.ts`, `build.ts`

```ts
export const ASSIST_PROFILE_SCHEMA_VERSION = 1;
export function buildAssistProfile(ctx: DocPackContext): AssistProfileResult
```

Covers `company`, `registeredOffice`, `subscribers[]`, `directors[]` per
`docs/02-profile-mapping.md`. Reuses `resolveProposedCompanyName`,
`resolveRegisteredOfficeResponses` and `proposed-directors.ts`. Emits `missing` and
`notes`.

Mirror `src/lib/doc-pack/inputs.ts` in style: small named resolvers per field group,
each stating which step it reads.

**Tests, required:**
- A full engagement produces a complete profile with `missing: []`
- An engagement without a registered office lists `company.registeredOffice` in
  `missing` with `stepId: 'pre-14'`, and omits the key from `profile`
- A Suite value with no `vocabulary.ts` entry is reported missing, not passed through
- Director order is preserved and `index` maps to array position
- Dates convert to `DD/MM/YYYY`
- `mcaLogin.userId` is empty
- **Parity test**, in the spirit of `doc-pack-parity.test.ts`: every profile key the
  tests assert on is a key the extension's `mapping.js` actually consumes. The key
  list is in `docs/02-profile-mapping.md`. A typo is otherwise invisible until a lead
  watches a field not fill

Verify: `npm run typecheck && npm run test`

## P2 — The remaining sections

Extend `build.ts` with `agile`, `moa`, `aoa`.

Expect most of these to resolve to `missing`. Suite does not hold AGILE-PRO-S
declarations, ESIC branch details or MOA witness data today. That is the correct
result, and the resulting list is the specification for what Suite should collect
next.

**Do not add fields to `checklist_state` to fill them.** Record the gap in
`QUESTIONS.md`.

Verify: `npm run typecheck && npm run test`

## P3 — Route and UI control

`src/lib/api/assist-profile.ts` holds the loader. Copy `src/lib/api/doc-pack.ts`'s
`loadDocPack` shape exactly: resolve through the repository with `AuthContext`,
return its error response on failure. Staff only — `super_admin`, `admin`, `manager`,
`intern`. Clients never reach it.

```
GET /api/engagements/[id]/assist-profile
→ 200 { ok: true, schemaVersion, companyName, profile, missing, notes }
→ 403 for a client or an unassigned staff member
→ 404 when the engagement does not exist or is not visible
```

No POST. Nothing writes.

**UI control** on the step page for Pre-4 (Name Application) and Pre-10 (SPICe+
Filing), in the form body, matching the existing doc-pack control's placement and
styling:

- A "Copy for Assist" button, copying the `profile` JSON to the clipboard with a toast
- Beside it, the missing count as a chip: none `--success`, any `--waiting`
- An expandable missing list, each row linking to its `stepId`/`tabId`, exactly as the
  doc-pack missing-input list already does

Staff shell only. Absent in the client shell.

Verify: `npm run typecheck && npm run test`, then open a real engagement at Pre-4 and
click the button.

---

## Done means

A lead opens Pre-4, sees what is missing, clicks Copy for Assist, and pastes a valid
profile into the extension. The retyping problem is solved by clipboard before any
extension work begins.
