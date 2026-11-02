# ✗ rows: client portal incorporation and account screens (30 Oct 2026)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-192 | ✓ | The phase steps table head sticks under the top bar (`top: var(--cp-top-h)`). The table box (`.sttb-x`) scrolls sideways only while the card is narrower than the 720 px table (container query); on wider cards it stops being a scroll box so the head can stick, and the card stops clipping (`section:has(.sttb.pin)`). Phase page only; the landing timeline keeps the plain table. |
| C-218 | ✓ | A client step that is still open (the client's own step in progress or waiting, or an open direct-flow step, not waiting on approval) draws an `Input` (a native select for select fields, a date input for dates) for every text answer the client may fill, and a "Save draft" footer button with PenLine. New route `POST /api/client/steps/:stepId/draft` calls the new `clientSaveStepDraft` in `client-incorporation.ts`: client only, own engagement (`assertEngagementAccess`), client step only, refuses closed or approval-pending steps, keeps only client-fillable text fields (locked steps: only unlocked fields), writes responses plus `lastEdited*`, never review or lock fields. Tests: `client-step-draft.test.ts` (other tenant, staff, closed step, field filter). |
| C-219 | ✓ | A step SBC or MCA holds ("with") has a card foot button "Message <lead first name>" that opens the Spectrum message dialog and posts to the existing `POST /api/client/messages` with `itemKey = step:<engagementId>:<stepId>` (`client_messages.item_key`). |
| C-247 | ✓ | Under the board resolution preview: "For <parent company>", an empty signature line, the authorised person's name and designation, place and date. Names come from the Part A merge fields that fill the Word draft (`buildBoardResolutionMergeFields`); placeholders read "-". No signature is drawn. |
| C-248 | ✓ | Beside it, a 74 px double ring stamp area rotated -12deg, dashed and in faint ink, holding the parent company name. It is an empty stamp box, never a stamp. |
| C-618 | ✓ | Phone Documents board: a sideways toolbar under the filter with Status and Replaced toggles, By step / By category (saves the same preference as desktop), Download all (ZIP) and Upload · N requested. Replaced files now show (with a Replaced tag) when the toggle is on. |
| C-741 | ✓ | Announcements get `link_path` (schema below). The detail footer shows "Open" when the announcement links to a portal page and navigates there. `POST /api/announcements` takes `linkPath`; `safePortalLinkPath` keeps only `/app/client/...` paths (tested). |
| C-759 | ✓ | Notifications store the sender (`actorId`, `actorName`) in the existing JSON payload of `notifications.description` (no column needed). `createNotification` stamps the caller; the engagement event fan-out and the client message fan-out pass the actor. The Notifications page shows the stored sender first, then the old name-in-text fallback for older rows. Tests in `notifications.test.ts`. |
| C-787 | ✓ | Every accepted sign-in writes an `auth.sign_in` audit event (`systemRecordSignIn` in `client-audit.ts`), from the Credentials `authorize` and from the Microsoft branch of the `jwt` callback. A client's event goes on its own engagement; staff events have no engagement. The client Audit page has the "Sign-in" area, rows read "Signed in" with Device, City and Method facts. Tests in `client-audit.test.ts`. |
| C-851 | ✓ | `user_sessions.city` (schema below) is filled at sign-in from CDN geo headers (`CloudFront-Viewer-City`, `X-Vercel-IP-City`, `CF-IPCity`; `src/lib/sign-in-device.ts`, tested). `listOwnSessions` returns it; Settings "This device" reads "Chrome on Windows · Hyderabad" when the current session has a city, else no city. App Runner alone sends no geo header, so production shows no city until a CloudFront distribution forwards it. |
| C-868 | ✓ | WhatsApp code step: when `WHATSAPP_ENABLED`, `EUM_PHONE_NUMBER_ID` and the new `WHATSAPP_TEMPLATE_NAME_VERIFY_CODE` are set, "Turn on WhatsApp" goes Number → Code → Done: six 44 px digit boxes (paste fills all), "Verify and turn on", "Send a new code", "Change number". Codes: new table `whatsapp_verify_codes` (hash only, 10 min, 5 tries, 5 sends an hour, one use) in `client-whatsapp-verify.ts`; sent through the EUM transport as a copy-code authentication template (`src/lib/notify/send-whatsapp-code.ts`). Route `GET/POST /api/client/account/whatsapp-code`. When not set up, the dialog shows a "Code check not set up" tag and keeps Number → Done. Tests in `client-whatsapp-verify.test.ts`. |
| C-899 | ✓ | Invite sign-in box: link tile, "Set-password link by email", "Expires in 7 days", Copy (copies the link). The dialog makes a link token (like it makes the temporary password); the server keeps its SHA-256 and a 7-day expiry on `client_invites` (schema below), on invite and on resend. The invite email now carries the link instead of the password (an older bundle without a token still gets the password). New public page `/set-password/<token>` and route `GET/POST /api/client/invite-password` (`systemPeekInviteToken`, `systemSetInvitePassword`: pending, unexpired, unrevoked invite still on its temporary password; one use; marks the invite accepted). The Substitute dialog still uses the temporary password (its route is `/api/engagements/.../clients/substitute`, not mine). Tests in `client-team.test.ts`. |

## Extra items from the hub

| Item | What I did |
|---|---|
| F-216 | The step page's phase rail shows the date at the right of each done step, with `threadDate` from `src/components/dash/thread.tsx`. Done steps without a date keep the owner word. |
| F-257 | The client home timeline editor's After list now has typed start and end date inputs per part (one for the COI); a typed date runs through the shared `cascadeEdit` from `src/components/dash/timeline-editor.tsx`, with Undo. The drag editor stays. CSS in `home-tle.css`. |
| documents.deleted_at | `getClientIncorporationExtras` now reads `documents` with `isNull(documents.deletedAt)`. |
| Microsoft sign-in audit | The Microsoft branch of the `jwt` callback writes the same sign-in audit event (method "Microsoft") and stores user agent and city on its session, read through `next/headers` (guarded). |
| Login screen | `SignInScreen` asks `getProviders()` and passes `onMicrosoft` only when `microsoft-entra-id` is listed; `LoginFormCard` then shows "Sign in with Microsoft" (secondary button with the four-square mark) under Sign in. `?error=microsoft_no_profile`, `microsoft_not_allowed`, `microsoft_linked_elsewhere`, `microsoft_two_step_on` show plain sentences (`MICROSOFT_ERRORS`). Tests added to `SignInScreen.test.tsx` (mock gained `getProviders`). |

## Files changed

- Incorporation: `src/components/client-portal/pages/incorporation/{StepTable,StepPage,BoardPage}.tsx`, `css-src/incorporation-extra.css`.
- Documents: `pages/documents/{Mobile,DocumentsPage}.tsx`, `css-src/documents-boards.css`.
- Team and account: `pages/team/{AnnouncementsPage,NotificationsPage,AuditPage,team-sections,common}.tsx`, new `pages/team/SetPasswordPage.tsx`, `pages/team/profile/{settings-view,whatsapp-dialog}.tsx`.
- Home: `pages/home/TimelineEditor.tsx`, `css-src/home-tle.css`. `node scripts/cp-css.mjs` was run.
- Auth: `src/auth/config.ts` (sign-in hook in `authorize` and in the Microsoft `jwt` branch only), `src/components/auth/{LoginFormCard,SignInScreen}.tsx`, `SignInScreen.test.tsx`.
- Repositories: `client-incorporation.ts`, `client-audit.ts`, `client-team.ts`, new `client-whatsapp-verify.ts`; small additive edits in `notifications.ts`, `announcements.ts`, `user-sessions.ts`. Tests: new `client-step-draft.test.ts`, `client-whatsapp-verify.test.ts`; added cases in `client-audit.test.ts`, `client-team.test.ts`, `notifications.test.ts`.
- Lib: new `src/lib/sign-in-device.ts` (+ test), new `src/lib/notify/send-whatsapp-code.ts`; additive edits in `src/lib/notifications/announcements.ts` (+ test), `src/lib/checklist/checklist-notifications.ts` (type), `src/lib/client-portal/audit.ts` (`'Sign-in'` area), `src/lib/email/welcome-email.ts` (`setPasswordUrl`), `src/lib/email/notify-engagement-event.ts` and `src/lib/messages/notify-messages.ts` (pass the actor).
- `.env.example`.

## New routes

- `POST /api/client/steps/:stepId/draft`
- `GET, POST /api/client/account/whatsapp-code`
- `GET, POST /api/client/invite-password` (public; the token is the authority)
- Page `/set-password/[token]` (`app/set-password/[token]/page.tsx`, public, outside the proxy matcher)
- `POST /api/announcements` takes `linkPath`; `POST /api/client/team` takes `setPasswordToken` on invite and resend.

## Schema added (for migration 0029)

- `announcements.link_path text` — in-app client portal page for the "Open" button.
- `user_sessions.city text` — sign-in city from CDN geo headers.
- `client_invites.set_password_token_hash text`, `client_invites.set_password_expires_at timestamptz`.
- New table `whatsapp_verify_codes` (`id uuid pk default random`, `user_id uuid not null → profiles on delete cascade`, `phone_e164 text not null`, `code_hash text not null`, `attempts integer not null default 0`, `expires_at timestamptz not null`, `used_at timestamptz`, `created_at timestamptz not null default now()`, index `whatsapp_verify_codes_user_idx (user_id, created_at)`).

Until 0029 runs, reads that select these columns fail locally (announcements list, device list, client team invite insert). Session creation catches its error, so sign-in still works, but without a `sid`.

## Env vars

- `WHATSAPP_TEMPLATE_NAME_VERIFY_CODE` — approved Meta AUTHENTICATION template with a copy-code button (body `{{1}}` = code). Unset: the dialog shows "Code check not set up".
- City (C-851) needs no env var, but needs CloudFront (or another CDN) in front of App Runner forwarding `CloudFront-Viewer-City`.

## Requests

- Staff announcement compose (not mine): add a "Portal page" field that sends `linkPath` (`/app/client/...`), or the Open button never shows.
- Staff audit view: `auth.sign_in` rows now appear for staff sign-ins too (no engagement). Give them a label ("Signed in") if the generic `formatAuditActionLabel` reads badly.
- `src/views/auth/InviteAccept.tsx` (`/invite/[token]`) is still the old AppContext mock; it can go once the set-password page is accepted.
- Login screen: the `?email=` the set-password page passes to `/login` is not read yet; `use-sign-in.ts` could prefill it.

## Decisions

- The client answer edit is a draft only; submitting stays with the existing approve or direct-flow submit. DECISIONS said answers were read-only; the owner asked for this row, so the draft path is client-scoped and leaves review fields alone.
- The board resolution sign-off draws no signature and no filled stamp, only empty places with real names.
- The notification sender lives in the existing JSON payload, not a new column, so older rows and every caller keep working.
- The WhatsApp code sender is its own small module on the same EUM transport, not a new nudge event: it goes out before consent and must use an authentication template, which `resolveWhatsAppChannel` (consent gate, body-only components) does not allow.
- The set-password token is made in the browser and only its hash is stored, matching how the temporary password already worked, so Copy can work before the invite is sent.

## Checks

- `npx tsc --noEmit -p .`: 0 errors.
- `npx eslint` on every file above: 0 errors (warnings only, as before).
- `npx vitest run` on `src/db/repositories`, `src/lib/{notifications,notify,email,messages,client-portal}`, `src/lib/sign-in-device.test.ts`, `src/components/{client-portal,auth,dash}`: 125 files, 1449 tests passed.
- The PROTOTYPE-DIFF table rows were not edited; the hub can set C-192, C-218, C-219, C-247, C-248, C-618, C-741, C-759, C-787, C-851, C-868, C-899, F-216 and F-257 to ✓.
