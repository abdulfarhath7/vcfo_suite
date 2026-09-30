# Build context — Ownership rename + "Group company" parent type + NOC variant (Create Project)

Scope: **Create / Edit Project form** used by **Firm Admin (`admin`) and Project Manager (`manager`)** — shared component, one change covers both. No change to Project Lead (`intern`), Client, or Super Admin screens except where a shared label helper renders the new wording.

NOC **templates are not provided yet.** This build captures the data and resolves *which* NOC applies. Actual `.docx` generation is a later prompt once templates arrive.

---

## 0. Global rules (apply to every phase)

- Repository seam is sacred: views never import `db`. Data flows view → API route → `src/db/repositories/*` with `AuthContext`.
- **Do not rename DB values.** `ownership_type` stays `'subsidiary' | 'independent'`; `company_type` stays `'domestic' | 'foreign'`. Only **UI labels** change. No data migration of existing rows.
- Do not touch: `src/data/checklist.ts`, step validators, `checklist-step-gate.ts`, `src/lib/incorporation-docs/*` generators, `src/lib/doc-pack/*` evaluation, subscription-sheet planning (`subscriptionPlan`), board-resolution finalize, email fan-out.
- Never show the word "intern" in UI.
- Read before writing: open every file listed in §2 first and report any deviation from what this doc says before changing anything.
- After each phase: `npx tsc --noEmit > /tmp/tc.log 2>&1; grep -c "error TS" /tmp/tc.log` → `npx vitest run --reporter=dot` → `npm run lint`. Report honestly; do not proceed on red.
- Commit at the end of each phase with the message given. No stopping for permission between phases.

---

## 1. What exists today (verified against repo, shallow clone)

| Concept | Code | Current UI label |
|---|---|---|
| Has a parent entity? | `ownershipType: 'subsidiary' \| 'independent'` (`src/data/engagements.ts`, `engagements.ownership_type`) | **"Company type"** → Dependent / Independent |
| Where the parent is | `companyType: 'domestic' \| 'foreign'` (`engagements.company_type`) | **"Parent entity origin"** → Domestic / Foreign (shown only when dependent) |
| Independent forces | `companyType = 'domestic'` (form reducer + repository line ~841) | — |

Label sources:
- `OWNERSHIP_TYPES`, `COMPANY_TYPES` in `src/components/admin/create-project-form-utils.ts`
- `OWNERSHIP_TYPE_LABEL`, `COMPANY_TYPE_LABEL` in `src/data/engagements.ts` (also used by `src/components/admin/company-picker-utils.ts`)
- Picker rendering: `src/components/admin/CreateProjectFormSections.tsx` (~L447 "Company type", ~L601 "Parent entity origin")

So "dependent on foreign / Indian company" **already maps to `companyType`**. The genuinely new data is the **Indian-parent relationship** (name only vs investing).

---

## 2. Target behaviour

### 2.1 Labels (the rename)

| Field | Old | New label | Options (label — hint) |
|---|---|---|---|
| `ownershipType` | Company type: Dependent / Independent | **Ownership** | **Group company** — "Backed by an existing company (parent / group)" · **Standalone company** — "Promoted by individuals — no parent company" |
| `companyType` (only when Group company) | Parent entity origin: Domestic / Foreign | **Parent company is** | **Foreign company** — "Incorporated outside India · FEMA track" · **Indian company** — "Incorporated in India" |
| `parentIndianRelationship` (only when Group + Indian) | — (new) | **Parent's role** | **Name use only** — "Lends its name; does not invest" · **Investing** — "Subscribes to shares of the new company" |

Picker order in the Entity section: Ownership → Parent company is → Parent's role → Starting phase → (parent details block, unchanged conditions) → Legal form.

Beneath the last visible picker, one muted line: `NOC: {label}` from §2.3, or nothing for Standalone. Plain text, no chip colour.

`COMPANY_TYPE_LABEL` elsewhere (e.g. company picker, headers): because Standalone is stored as `domestic`, **do not** globally relabel `domestic` → "Indian company". Instead add a display helper `ownershipDisplayLabel(engagement)` returning `Standalone` / `Group · Foreign parent` / `Group · Indian parent (name use)` / `Group · Indian parent (investing)` and switch existing display sites to it. List every site changed in the report.

### 2.2 Data

New nullable column on `engagements`:

```
parent_indian_relationship text  -- 'name_only' | 'investing' | null
```

Invariant (enforced in **zod schema + repository**, same pattern as `parentEntityName` clearing):
- Required when `ownershipType = 'subsidiary'` **and** `companyType = 'domestic'`.
- Forced to `null` otherwise (Standalone, or Foreign parent). Switching Group→Standalone or Indian→Foreign clears it.
- Existing rows: stay `null`. Edit form treats Group+Indian+null as "not yet chosen" and requires a pick on save. Do not backfill.

Type: `export type ParentIndianRelationship = 'name_only' | 'investing'` in `src/data/engagements.ts`, plus `coerceParentIndianRelationship(v: unknown)` returning the value or `null`. Add optional field to `Engagement`.

### 2.3 NOC variant (pure function — the only NOC logic in this build)

`src/lib/noc/variant.ts`:

```ts
export type NocVariant = 'foreign-parent' | 'indian-name-only' | 'indian-investing';

export function resolveNocVariant(e: {
  ownershipType?: string | null;
  companyType?: string | null;
  parentIndianRelationship?: string | null;
}): NocVariant | null
```

| ownershipType | companyType | parentIndianRelationship | → |
|---|---|---|---|
| independent | * | * | `null` |
| subsidiary | foreign | * | `foreign-parent` |
| subsidiary | domestic | name_only | `indian-name-only` |
| subsidiary | domestic | investing | `indian-investing` |
| subsidiary | domestic | null | `null` (incomplete) |

`src/lib/noc/templates.ts` — registry for the future generator, **no generation yet**:

```ts
export const NOC_TEMPLATES: Record<NocVariant, {
  label: string;               // 'NOC — Foreign parent' | 'NOC — Indian parent (name use)' | 'NOC — Indian parent (investing)'
  templateRelative: string;    // 'public/templates/noc-foreign-parent.docx' etc. (files do not exist yet)
  downloadFilename: string;    // 'noc-foreign-parent.docx' etc.
  mergeFieldKeys: readonly string[]; // [] until templates arrive
}>;
```

Follow the shape of `INCORP_DOC_DEFINITIONS` in `src/lib/incorporation-docs/types.ts` so the later integration is a move, not a rewrite. Do **not** register NOC kinds in `INCORP_DOC_DEFINITIONS` or the doc-pack registry in this build (would affect pre-7 "all generated" checks).

---

## 3. Phases

### Phase 1 — Types, schema, migration, repository

Files:
- `src/data/engagements.ts` — new type, coercer, `Engagement.parentIndianRelationship`, `ownershipDisplayLabel`, updated `OWNERSHIP_TYPE_LABEL` (`subsidiary: 'Group company'`, `independent: 'Standalone company'`).
- `src/db/schema.ts` — add `parentIndianRelationship: text('parent_indian_relationship')` beside `ownershipType`.
- Migration via `npm run db:generate` into `src/db/migrations/` (next number after the latest). Additive only.
- `src/lib/api/schemas.ts` — `parentIndianRelationshipSchema = z.enum(['name_only','investing'])`; optional/nullable on create + patch; add to the existing superRefine: required when subsidiary+domestic with message "Choose whether the Indian parent lends its name or invests."
- `src/db/repositories/engagements.ts` — persist on create (~L834 block) and patch; clear per invariant; map row → `Engagement`.
- `src/lib/engagements-db.ts` + `app/api/engagements/[id]/route.ts` — thread the field through the patch path (same as `parentEntityName`).
- `src/lib/noc/variant.ts`, `src/lib/noc/templates.ts` + `src/lib/noc/__tests__/variant.test.ts` (every row of the §2.3 table).
- Repository test: create Group+Indian+investing persists; patch to Foreign clears it; patch to Standalone clears it; Group+Indian without it → 400.

Preserve: `ownership_type` / `company_type` values and defaults; `stageRequiresSubsidiary` / `stageRequiresParentEntity`; `checklistState` seeding for independent.

Gate → commit: `feat(engagements): parent_indian_relationship + NOC variant resolver`

### Phase 2 — Create / Edit Project form (admin + manager)

Files:
- `src/components/admin/create-project-form-utils.ts` — relabel `OWNERSHIP_TYPES`, `COMPANY_TYPES` (§2.1); add `PARENT_INDIAN_RELATIONSHIPS`; add `parentIndianRelationship` to `CreateProjectState`; draft parser (~L204) coerces it so **old localStorage drafts still load** (missing → `null`).
- `src/components/admin/CreateProjectForm.tsx` — initial state `null`; hydrate from engagement in edit mode (~L60); reducer: selecting Standalone or Foreign sets it `null`; validity: required only when Group+Indian; include in both POST and PATCH bodies (~L428, ~L486) using the same "clear when not applicable" guard as `companyType`; field error message as in Phase 1.
- `src/components/admin/CreateProjectFormSections.tsx` — rename the two labels; move "Parent company is" directly under Ownership; add "Parent's role" `SegmentedPicker` (same component/styling, `max-w-xs`) shown only for Group+Indian; show the muted `NOC: …` line from `resolveNocVariant` + `NOC_TEMPLATES[v].label`. Include the new field in `sectionComplete` for the Entity tab.
- Switch display sites of the old labels to `ownershipDisplayLabel` (grep `OWNERSHIP_TYPE_LABEL`, `COMPANY_TYPE_LABEL`, incl. `company-picker-utils.ts`).

Preserve: admin POST must still include `managerId`; manager POST still forces self. Subsidiary legal name/address and parent details still required when starting at Registration/Compliance. Draft persistence behaviour. Keyboard/ARIA wiring of existing pickers (`labelledBy`, `FieldError` ids).

Tests: form-utils draft parse (old draft without field → null); validity matrix (Standalone valid without it; Group+Foreign valid without it; Group+Indian invalid until chosen).

Gate → commit: `feat(create-project): rename ownership labels, add Indian parent role, show NOC variant`

### Phase 3 — Report (no code)

Output: files changed, every display site relabelled, migration file name, test counts before/after, and the open questions in §4 verbatim so the owner can answer them before the NOC generator prompt.

---

## 4. Open questions (do not resolve in code — surface them)

1. **Name-use-only parent and the existing parent-entity flow.** Today every `subsidiary` gets parent-entity Part A sections, the parent board resolution (pre-2/pre-3), the authorisation + acceptance letters, and a body-corporate subscription sheet where the parent subscribes. A name-use-only Indian parent does **not** subscribe. Should any of these be hidden for `indian-name-only`? (This build changes none of them.)
2. **When is the NOC generated?** At creation the proposed company name (Part A) and parent signatory usually don't exist yet. Options: (a) generate on demand from the project page once inputs are present, with a doc-pack-style "missing inputs" list; (b) generate inside Name Application (pre-4) alongside the name reservation. Recommendation: (a) + surface in pre-4.
3. **Who sees it?** Client-downloadable (parent must sign it) or staff-only until finalized, like the board resolution?
4. **Template fields.** Each template will define its merge keys; confirm expected inputs (parent name, CIN / foreign registration no., registered address, signatory name + designation, board meeting date, proposed company name(s), investing: number of shares / amount).

---

## 5. Out of scope for this build

NOC `.docx` generation, S3 storage of the NOC, email/notification on NOC, adding a checklist step, doc-pack registry entries, any change to subscription planning or FEMA logic.
