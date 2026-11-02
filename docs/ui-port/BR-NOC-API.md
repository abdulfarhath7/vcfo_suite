# Board resolution (NOC): data and route contract

Owner of this contract: the br-noc data and staff agent (30 Oct 2026). The client page agent and
the shared document part agent call these. Spec: the prototype's `docs/BOARD-RESOLUTION-NOC.md`.

Pure helpers (safe in client components) live in `src/lib/noc/`:

- `variant.ts`: `resolveNocVariant()`, `NocVariant` (unchanged).
- `templates.ts`: `NOC_TEMPLATES[variant].label` ("NOC — Foreign subsidiary") and the internal file
  name (staff only on screen).
- `receive.ts` (new): `NOC_STEP_LABEL`, `nocTrackKeys(foreign, notaryStepsOff)`,
  `nocReceiveChecks(foreign, notaryStepsOff)`, `allChecksTicked()`, `isForeignVariant()`,
  `nocVariantPath(answers)` (the decision-tree path for C8, see below).
- `fields.ts` (new): `NOC_FIELD_LABEL` (a label for each board-resolution merge key),
  `nocSnapshotFields()`, `diffNocFields()`.

## Step states

| Key | Label | Who sets it | Stored in |
|---|---|---|---|
| `drafted` | Drafted | Generate (lead) | `engagement_board_resolutions.drafted_at` |
| `released` | Released | Manager approve (finalize) | `finalized_at`, `finalized_by` |
| `signed` | Signed | Signed copy upload (client or staff) | `signed_uploaded_at`, `signed_uploaded_by` |
| `notarised` | Notarised | Staff tick the "Notary stamp" check | `notarised_at`, `notarised_by` (new) |
| `apostilled` | Apostilled | Staff tick the "Apostille certificate" check | `apostilled_at`, `apostilled_by` (new) |
| `accepted` | Accepted | Staff Accept (all checks ticked) | `accepted_at`, `accepted_by` (new) |

`notarised` and `apostilled` appear only for a foreign parent (`variant === 'foreign-parent'`) and
only when `notary_steps_off` is false (D1: SBC can turn them off for one client). The track is
6 steps for a foreign parent and 4 for an Indian parent.

Send back stores `sent_back_at`, `sent_back_by`, `sent_back_reason` (new). A new signed upload
clears the send back, the checks and the notarised/apostilled stamps, because the copy is new.

Existing engagements: the hub runs the backfill in "Backfill" below, so a copy that was Received
(pre-3 accepted) before this build reads as Accepted. After the backfill the only rule is
`accepted_at IS NOT NULL`.

## GET `/api/engagements/:id/board-resolution/noc`

Roles: client, intern, manager, admin, super admin (scoped through the repository; another
tenant's engagement is 404). Response `{ ok: true, noc: NocState }`.

```ts
type NocVariant = 'foreign-parent' | 'indian-name-only' | 'indian-investing';
type NocStepKey = 'drafted' | 'released' | 'signed' | 'notarised' | 'apostilled' | 'accepted';

interface NocState {
  /** The variant the draft uses: staff override, else the answers, else foreign-parent (as generation does). */
  variant: NocVariant;
  /** "NOC — Foreign subsidiary" etc. The page subtitle. */
  variantLabel: string;
  /** resolveNocVariant(answers): null means standalone or "Indian parent, role not chosen". */
  resolvedVariant: NocVariant | null;
  /** The three Project setup answers (C8 evidence rows "Project setup · …"). */
  answers: { ownershipType: string | null; companyType: string | null; parentIndianRelationship: string | null };
  /** Parent entity name from the engagement (Pre-1 wins on the page through the merge fields). */
  parentName: string | null;
  foreignParent: boolean;
  notaryStepsOff: boolean;
  /** In order; 6 steps (foreign) or 4 (Indian). `byName` is a display name, never an id. */
  track: Array<{ key: NocStepKey; label: string; done: boolean; at?: string; byName?: string }>;
  accepted: boolean;
  sentBack: { at: string; byName?: string; reason: string } | null;
  /** Latest draft version number, null before versions were recorded. */
  version: number | null;
  /** Present for staff only. A client response never carries it. */
  staff?: {
    /** Internal file name, e.g. "noc-foreign-parent.docx". Never show to a client (P5). */
    templateFileName: string;
    override: { variant: NocVariant; reason: string; at: string; byName?: string } | null;
    checks: Array<{ key: string; label: string; ticked: boolean; at?: string; byName?: string }>;
    /** Set when a feeding answer changed after the latest version (T3). */
    outOfDate: { changes: Array<{ key: string; label: string; before: string; after: string }> } | null;
    vaultDocumentId: string | null;
    canChangeTemplate: boolean; // admin, super admin, manager
    canReceive: boolean; // every staff role (tick, Accept, Send back)
  };
}
```

## POST `/api/engagements/:id/board-resolution/noc`

Staff only (intern, manager, admin, super admin). Body is one of:

| Body | Rule | Audit action |
|---|---|---|
| `{ action: 'check', key, ticked }` | Needs a signed copy, not yet accepted. `notary_stamp` also stamps Notarised; `apostille` stamps Apostilled. | `board_resolution.check` |
| `{ action: 'accept' }` | Every check ticked (409 `checks_incomplete` otherwise). Files the signed copy to the Vault (step pre-3, category "Board resolution"). | `board_resolution.accepted` |
| `{ action: 'send_back', reason }` | Reason required (400). Notifies the client (`review_rejected` on pre-3, with the reason). | `board_resolution.sent_back` |
| `{ action: 'change_template', variant, reason }` | Admin, super admin, manager only (403). Reason required. Make the draft again afterwards. | `board_resolution.template_changed` |
| `{ action: 'notary_steps', off }` | Admin, super admin, manager only. Foreign parent only. | `board_resolution.notary_steps` |

Response `{ ok: true, noc: NocState }` (the staff shape). Errors `{ ok: false, error }`.

"Make the draft again" is the existing `POST /api/engagements/:id/board-resolution/generate`
with `{ forceTemplateRefresh: true }` once finalized (the repair path) or plain before. Every
generate now also records a version (below) and honours the template override.

## GET `/api/engagements/:id/board-resolution/versions`

Staff only. `{ ok: true, versions: Array<{ version: number; variant: NocVariant; createdAt: string;
byName?: string; fields: Record<string, string> }> }`, newest first. Compare two with
`diffNocFields(a.fields, b.fields)` from `src/lib/noc/fields.ts`.

## Decision tree (C8)

`nocVariantPath(answers)` returns
`{ ownership: 'standalone' | 'subsidiary' | null, parent: 'foreign' | 'indian' | null,
role: 'name_only' | 'investing' | 'not_chosen' | null, result: NocVariant | 'none' | 'incomplete' }`,
built only from `resolveNocVariant()` and the same coercions, so the lit path always matches the
variant. Evidence row labels: "Project setup · Ownership type", "Project setup · Company type",
"Project setup · Parent's role".

## Backfill (the hub runs it with the migration)

```sql
-- Additive columns and the versions table come from src/db/schema.ts (db:generate).
-- Then: a signed copy that was Received (pre-3 accepted) before this build reads as Accepted.
UPDATE engagement_board_resolutions br
SET accepted_at = COALESCE(
      CASE WHEN (e.checklist_state->'pre-3'->>'reviewedAt') ~ '^\d{4}-\d{2}-\d{2}'
           THEN (e.checklist_state->'pre-3'->>'reviewedAt')::timestamptz END,
      br.signed_uploaded_at,
      now()),
    accepted_by = (SELECT p.id FROM profiles p WHERE p.id::text = e.checklist_state->'pre-3'->>'reviewedBy')
FROM engagements e
WHERE e.id = br.engagement_id
  AND br.accepted_at IS NULL
  AND br.signed_storage_path IS NOT NULL
  AND e.checklist_state->'pre-3'->>'reviewStatus' = 'accepted';
```

Note: once the schema change is in, every `select()` on `engagement_board_resolutions` reads the new
columns, so the migration must be applied before this code runs against a database.

A client calling GET before release gets the variant and an empty track (no document stamps), the
same rule as the board resolution row.

## GET `/api/engagements/:id/spice-attachments` (T6, 30 Oct 2026)

Staff only (intern, manager, admin, super admin); a client or developer gets 403. The
repository `src/db/repositories/spice-attachments.ts` scopes through `getDocPackInputs`, so an
engagement outside the caller's scope is 403 and a missing one 404. No table: the list is
derived by `deriveSpiceAttachments()` in `src/lib/spice-attachments/derive.ts` from the
checklist step status, the document pack and the NOC state.

Response `{ ok: true, list: { items, done, total } }`. Each item has `key`, `label`, `stepId`,
`stepTitle`, `status` (`not-started` | `waiting` | `done`), `detail` and `vaultDocumentId`.
When the NOC is Accepted, the `board-resolution` item is Done and carries the Vault document id
of the accepted copy. The staff engagement page (lead, manager, admin) and the super admin
project page show the list in a `DashSection` under the SPICe+ steps.
