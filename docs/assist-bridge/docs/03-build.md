# 03 — Suite side

## The pure module

`src/lib/assist-profile/build.ts`

```ts
export const ASSIST_PROFILE_SCHEMA_VERSION = 1;

export function buildAssistProfile(ctx: DocPackContext): AssistProfileResult
```

Takes the context `buildDocPackContext()` already produces. Returns the result shape
from `docs/02`. No `db`, no `fetch`, no React. This is what makes it testable and what
lets the clipboard button and the API route share one implementation.

Mirror `src/lib/doc-pack/inputs.ts` in style: small named resolvers per field group,
each stating which step it reads.

## Tests — required in this repo

Follow the pattern beside `src/lib/doc-pack/*.test.ts`. At minimum:

- A full engagement fixture produces a complete profile with `missing: []`
- An engagement missing the registered office lists `company.registeredOffice` in
  `missing` with `stepId: 'pre-14'`, and omits the key from `profile`
- A Suite value with no `vocabulary.ts` entry is reported missing, not passed through
- Director order is preserved and `index` maps to array position
- Dates convert to `DD/MM/YYYY`
- `mcaLogin.userId` is always empty

Add a parity test in the spirit of `doc-pack-parity.test.ts`: every profile key the
tests assert on is a key `mapping.js` actually consumes. A typo in a profile key is
otherwise invisible until a lead watches a field not fill.

## The route

`app/api/engagements/[id]/assist-profile/route.ts`, with
`src/lib/api/assist-profile.ts` holding the loader.

Copy `src/lib/api/doc-pack.ts`'s `loadDocPack` shape exactly: resolve through the
repository with `AuthContext`, return its error response on failure. Staff only.

```
GET /api/engagements/[id]/assist-profile
→ 200 { ok: true, schemaVersion, companyName, profile, missing, notes }
→ 403 for a client or an unassigned staff member
→ 404 when the engagement does not exist or is not visible
```

No POST. Nothing writes.

## The Suite UI control

On the step page for Pre-4 (Name Application) and Pre-10 (SPICe+ Filing), in the form
body, matching the existing doc-pack control's placement and styling:

- A button, "Copy for Assist"
- Beside it, the missing count as a chip: none is `--success`, any is `--waiting`
- Clicking copies the `profile` JSON to the clipboard and toasts
- Expanding the missing list shows each item as a row linking to its `stepId`/`tabId`,
  exactly as the doc-pack missing-input list already does

This is a staff control. It does not appear in the client shell.

## What not to touch

Gate logic, email fan-out, board-resolution finalize, the checklist catalog,
`checklist_state` writes. This feature reads and nothing else. If a change seems to
require writing, it belongs in a different piece of work — record it in
`QUESTIONS.md`.
