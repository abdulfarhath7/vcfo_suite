# X-fix: board resolutions, staff sign-in settings, super admin client record (30 Oct 2026)

| No. | New status | What you did, or why it stays |
|---|---|---|
| S-556 | ✓ | New route `/app/manager/projects/[slug]/board-resolution` renders the same editor. The manager may edit while the draft is with them (the server already allowed it: `assertLeadMayEdit` only locks the lead), and the Stage card gives "Approve and send to client" (the existing finalize route) and "Send back" with a note (the existing `pre-2` review) while the lead's request is pending. The lead-only "Send for manager approval" button is hidden. Access: the manager shell's role guard, then every API call goes through `assertEngagementBoardResolutionAccess` → `getEngagementById` (role scope). |
| S-557 | ✓ | Same editor at `/app/admin/projects/[slug]/board-resolution`, same staff mode. Super admin passes the admin guards through `requireAnyRole`. |
| S-574 | ✓ | Staff upload of the signed copy. `POST /api/engagements/:id/board-resolution/upload-signed` now admits client, lead, manager, admin and super admin; the file goes to S3 through `src/storage/board-resolution` (unchanged), the row through `setSignedBoardResolution`, which now refuses any other role before a read (developer), and every upload writes an `board_resolution.signed_upload` audit event. The editor's Stage card shows "Upload signed copy" once finalized (primary after "Sent to client", outline before). The green box now reads "Signed copy uploaded". Test: `board-resolution-signed.test.ts` (role refusal, cross-tenant for five roles, draft refused). |
| P-112 | ✓ | New route `/app/super/projects/[id]/board-resolution` with the editor. Linked from the super client record head ("Board resolution") and from the Step 2 (`pre-2`) row of the Steps card. |
| P-113 | ✓ | The super admin gets the full editor: editable preview with the Bold / Italic / Underline format bar and "Unsaved changes", Word document actions, the five-stage Stage card, and the head chip (Draft, With manager, Finalized, Sent, Signed). The prototype's "Final" word is "Finalized" here, the word the rest of the tool uses. |
| P-095 | ✓ | Each step row of the super Steps card has "What's this?", which opens the shared staff `StepAboutPanel` (step description, inputs, forms, MCA rule, Assist profile gaps, lead notes, Ask follow-up where Ask is on). |
| P-100 | ✓ | New Fees tab: "Fees by service" grid (service, fee, billing, status) and an "Outstanding" card (amount, outstanding for N days, ageing bucket; "Nothing outstanding" when none). Data path built: table `engagement_fees`, repository `engagement-fees.ts` (super admin, admin and the engagement's manager; role check first, engagement through `getEngagementById`, writes filtered by engagement and line id, audited), routes `GET/POST /api/engagements/:id/fees` and `PATCH/DELETE /api/engagements/:id/fees/:feeId`, and an Add / Edit dialog. No sample numbers: the grid starts empty ("No fees yet"). Test: `engagement-fees.test.ts`, `src/lib/fees/outstanding.test.ts`. |
| S-650 | ✓ (Microsoft sign-in) | The Microsoft Entra ID provider that ships with next-auth v5 is added in `src/auth/microsoft.ts` and spread into `config.ts` providers only when `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET` and `_ISSUER` are all set (the issuer is required, so the `common` tenant fallback is never used). The `signIn` callback refuses unless the Microsoft email (or an earlier link by subject) names an existing, active staff profile; the `jwt` callback then maps the token onto that profile (sub, role, scoping ids, a `user_sessions` row) and writes a `sign_in_links` row. No profile is ever created. Profile › Sign-in and security shows a "Microsoft sign-in" row for staff: "Not set up" when the env vars are missing, "Connected" with the address and date, or "Not connected" with Connect; Disconnect removes the link. API tokens: the prototype shows that row only in the developer portal (`portal === "dev"`, linking to `/dev/access`), not for lead, manager or admin, so it is not built here (see requests). Test: `sign-in-links.test.ts`. |
| S-653 | ✓ (stale) | Already built on 29 Oct: `profiles.designation` and `profiles.membership_no` exist, Profile shows "Designation" and "Membership number" (ICAI or ICSI) read rows and edit fields for staff (`AccountSettings.tsx` lines 217 and 270). |

## Files changed

- `src/views/intern/useBoardResolutionEditorState.tsx` — viewer mode (`isLead`, `lockedForViewer`, `staffShell`), `handleApprove`, `handleSendBack`, `handleUploadSigned`; step links follow the shell.
- `src/views/intern/BoardResolutionEditorView.tsx` — staff approve / send back, upload signed copy, send-back dialog, role-aware words, SEO path from the URL.
- `src/views/intern/BoardResolutionEditorDocPanel.tsx` — props; edit lock only for the lead; lead-only "Send for manager approval".
- `app/app/manager/projects/[slug]/board-resolution/page.tsx`, `app/app/admin/projects/[slug]/board-resolution/page.tsx`, `app/app/super/projects/[id]/board-resolution/page.tsx` — new.
- `app/api/engagements/[id]/board-resolution/upload-signed/route.ts` — staff roles, audit event.
- `src/db/repositories/board-resolution.ts` — role guard on `setSignedBoardResolution`.
- `src/db/repositories/board-resolution-signed.test.ts` — new.
- `src/db/repositories/engagement-fees.ts`, `engagement-fees.test.ts` — new.
- `src/lib/fees/outstanding.ts`, `outstanding.test.ts` — new.
- `app/api/engagements/[id]/fees/route.ts`, `schema.ts`, `[feeId]/route.ts` — new.
- `src/components/super/project/SuperProjectFees.tsx` — new.
- `src/components/super/project/SuperProjectJourney.tsx` — "What's this?" and the board resolution link.
- `src/views/super/SuperProjectDetail.tsx` — Fees tab, "Board resolution" head button.
- `src/auth/microsoft.ts` — new. `src/auth/config.ts` — Microsoft provider spread, `signIn` callback, Microsoft branch at the top of `jwt` (the password branch and `events` are untouched).
- `src/db/repositories/sign-in-links.ts`, `sign-in-links.test.ts` — new.
- `app/api/account/sign-in-links/route.ts` — new.
- `src/views/settings/account/MicrosoftSignInRow.tsx` — new. `src/views/settings/AccountSettings.tsx` — one import and one line in the security section.
- `src/db/schema-firm.ts` — two tables appended (below). `.env.example` — three commented env vars.

## New routes

- Pages: `/app/manager/projects/[slug]/board-resolution`, `/app/admin/projects/[slug]/board-resolution`, `/app/super/projects/[id]/board-resolution`.
- API: `GET, POST /api/engagements/:id/fees`; `PATCH, DELETE /api/engagements/:id/fees/:feeId`; `GET, DELETE /api/account/sign-in-links`. Changed: `POST /api/engagements/:id/board-resolution/upload-signed` (staff admitted).
- Auth.js callback (when set up): `/api/auth/callback/microsoft-entra-id`.

## Schema added (for migration 0029)

In `src/db/schema-firm.ts`:

- `sign_in_links`: `id uuid pk default random`, `profile_id uuid not null → profiles.id on delete cascade`, `provider text not null`, `subject text not null`, `email text not null`, `linked_at timestamptz not null default now()`, `last_used_at timestamptz`. Unique `(provider, subject)` as `sign_in_links_provider_subject_uidx`; unique `(profile_id, provider)` as `sign_in_links_profile_provider_uidx`.
- `engagement_fees`: `id uuid pk default random`, `engagement_id uuid not null → engagements.id on delete cascade`, `service text not null`, `amount_rupees integer not null`, `billing text not null default 'one_time'`, `status text not null default 'not_billed'`, `billed_on date`, `paid_on date`, `created_by uuid → profiles.id on delete set null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. Index `engagement_fees_engagement_idx (engagement_id)`.

## Env vars

- `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` (all three or Microsoft sign-in stays off). Redirect URI to register: `{AUTH_URL}/api/auth/callback/microsoft-entra-id`.

## Requests

- Login page owner: add a "Sign in with Microsoft" button (`signIn('microsoft-entra-id')`) shown only when set up, and words for `?error=microsoft_no_profile`, `microsoft_not_allowed`, `microsoft_linked_elsewhere`, `microsoft_two_step_on`. Today a person can start Microsoft sign-in only from the Profile row's Connect.
- Login page owner: the sign-in audit hook in `src/auth/config.ts` (other agent) should also cover the Microsoft branch at the top of the `jwt` callback.
- Owner of `src/components/incorporation/BoardResolutionStepLink.tsx` and `ManagerBoardResolutionReview.tsx`: link the manager and admin step page (`pre-2`) to the new `…/projects/[slug]/board-resolution` editor. The review panel still says "The lead's editor is never opened to the manager"; that comment is now out of date.
- Developer console owner: API tokens live in the developer portal in the prototype (`/dev/access`); if wanted, they need a `personal_api_tokens` table and bearer-token support in `currentContext`, which no route reads today.

## Decisions

- Microsoft sign-in is refused while two-step sign-in is on, because the Microsoft flow cannot ask for the app code and a person who turned two-step on expects every sign-in to need it. The Profile row says so and disables Connect. The owner may change this if the firm tenant enforces Entra MFA.
- Microsoft sign-in is for staff only (super admin, admin, manager, lead). Clients and the developer role are refused.
- The Microsoft provider's default profile fetches the Graph photo as base64 into the token; the override drops it to keep the JWT cookie small.
- A manager or admin may edit the draft while it is with them (the server already allowed it); only the lead is locked.
- Fees are whole rupees; outstanding is every "Billed" line not yet "Paid", aged from the oldest invoice day.

## Checks

- `npx tsc --noEmit -p .`: clean at the end of this round.
- `npx vitest run` on board-resolution, engagement-fees, sign-in-links, fees, auth, settings, super and board-resolution lib tests: 17 + 1 files, all pass.
- `npx eslint` on every file above: 0 errors (warnings are the existing React compiler notes in the board resolution hook).
