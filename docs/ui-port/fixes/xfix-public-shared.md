# ✗ round: public pages and shared staff screens (30 Oct 2026)

Brief: `docs/ui-port/X-BRIEF.md`. Earlier reports: `fix-public-part.md`, `fix-dev-public-shared.md`.
I did not edit `PROTOTYPE-DIFF.md`; the hub carries these statuses into it.

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-434 | ✓ | `GUIDE` entries in `content.ts` now carry `href`, the real portal screen each answer is about (client overview, incorporation, registrations, compliances, and each role's home). `AskGuide` shows the secondary "Open the screen" link between "Show me" and "Book a demo" when demo mode is on (`NEXT_PUBLIC_DEMO_LOGINS=on`). If the visitor is signed out, the proxy sends them to sign in first. In production the landing has no demo logins, so the link stays hidden there. |
| P-454 | ✓ | `SignInScreen` shows the mono hint "Demo mode, sample data" at the top right in demo mode only. It is hidden on phones. In demo mode the logins and firms come from the demo seed, so the words are true. Without the flag, no label shows. |
| P-470 | ✓ | `LoginFormCard` shows the same hint under the form on phones (`sm:hidden`), in demo mode only. |
| P-474 | ✓ | New `/portals` page (`app/portals/page.tsx`) lists every portal home: initials avatar, title, demo login and the mono path. The links go to each portal home, the landing page and sign in. It reads the seeded demo logins (`DEMO_ACCOUNTS`, which now include `title` and `home`, matching the proxy's role homes), so it shows only in demo mode. Without the flag it shows "Demo portals are not set up". There is no "Client · after incorporation" link, because the real tool has no state switch. I also added `/sign-in` as an alias that redirects to `/login` and keeps the query string, because the prototype links there. |
| P-575 | ✓ | The data path is built. Every checklist upload (clients included) now writes its index row through the new `indexMilestoneUpload` repository function. A newer upload to the same field marks the field's earlier rows with `replaced_at` and `replaced_by_id`. Loose `vault` uploads never replace one another. The vault has an R-10 "Replaced" toggle chip with an EyeOff icon, off by default. When it is off, replaced files are left out of the tree, the counts and the ZIPs. When it is on, they show muted and struck through, with a "Replaced" tag and no status glyph. The preview head shows an idle "Replaced" chip. A file that a checklist step still holds never counts as replaced. |
| P-596 | ✓ | Delete is built. The row menu has a red "Delete" entry, last after a rule. It opens `DangerConfirm` ("Delete <file>?", type DELETE, "Delete document"). The delete is a soft delete (`deleted_at`, `deleted_by`) through `DELETE /api/documents/:id`, followed by the A2 toast with Undo. Undo calls `POST /api/documents/:id/restore`. Only indexed files can be deleted. A file that a checklist step still holds is refused with 409 `in_use`, because it is replaced from its step. Admins and managers can delete any file in scope; a lead can delete only their own uploads. Restore is allowed for the person who deleted the file, or for an admin or manager. Both write audit events (`document.delete`, `document.restore`). A deleted row is hidden from `listDocuments` and `getDocumentById`, and so from the preview, ZIP and signed-URL routes. |
| P-630 | ✓ (stale) | Foundations built this on 30 Oct and I checked it: `AppearanceSettings` has the Comfortable / Compact `SpectrumTabs`. These write `vcfo.density` and `data-density` on `<html>`, `app/providers.tsx` applies it on load, and grids fall back to it through `readDensity(scope)`. |
| P-631 | ✓ (stale) | Same check: Small / Default / Large writes `vcfo.text-size` and `data-text-size`, and `globals.css` scales the page through `--text-scale`. |

Also moved by this work. These rows are not mine to close, but the data now exists:

- **P-593 (◐ → ✓ except Verify):** the preview facts now read Client, Step, **From**, Date, File. From is the client's name for a client upload, "SBC · <name>" for a staff upload, or "—" when no uploader was recorded. There is still no Verify, because files have no portal link.
- **P-586 (◐ stays):** the "Replaced" tag with strike is built. There is still no "Older than 2 months" tag.

## Files changed

- `src/db/schema.ts`: four columns on `documents` (see below).
- `src/db/repositories/documents.ts`: an uploader join (`uploadedByName`, `uploadedByRole`), `replacedAt` and `replacedById` on the DTO, a soft-delete filter on every read, and the new `indexMilestoneUpload`, `deleteVaultDocument` and `restoreVaultDocument`.
- `src/db/repositories/documents.test.ts` and `documents-vault.test.ts`: soft-delete SQL, and cross-tenant tests for index, delete and restore.
- `app/api/engagements/[id]/milestone-documents/route.ts`: indexes every upload (clients too) through `indexMilestoneUpload`.
- `app/api/documents/[id]/route.ts` (new, DELETE) and `app/api/documents/[id]/restore/route.ts` (new, POST).
- `src/views/vault/DocumentVaultPage.tsx`, `vault-explorer-parts.tsx`, `vault-files.ts` (with its test) and `use-vault-actions.ts`.
- `src/components/auth/demo-accounts.ts`, `SignInScreen.tsx` and `LoginFormCard.tsx`.
- `src/components/marketing/landing/AskGuide.tsx` and `content.ts`.
- `app/portals/page.tsx` (new) and `app/sign-in/page.tsx` (new).

## New routes

- `DELETE /api/documents/:id`: soft-deletes a vault file.
- `POST /api/documents/:id/restore`: Undo for a delete.
- `/portals`: the demo portal chooser.
- `/sign-in`: an alias of `/login`.

## Schema added (for migration 0029)

Table `documents`:

- `replaced_at timestamptz null`: when a newer upload to the same checklist field took this file's place.
- `replaced_by_id uuid null`: the newer upload's `documents.id`. It has no FK.
- `deleted_at timestamptz null`: soft delete from the vault.
- `deleted_by uuid null references profiles(id) on delete set null`: who deleted the file.

## Env vars

None are new. `NEXT_PUBLIC_DEMO_LOGINS` is already in `.env.example`. It now also turns on the sign-in hint, "Open the screen" in the Ask guide, and `/portals`.

## Requests

- **Other readers of `documents`:** `credentials/registrations.ts` (line ~104) and `client-incorporation.ts` (line ~305) do not filter `deleted_at`. They should add `isNull(documents.deletedAt)`. In practice those files are step files, which the vault refuses to delete, so the risk is low.
- **Client-home uploads:** `client-home.ts` hard-deletes its own rows in its Undo window, which is unchanged and fine.
- **Foundations:** `DropdownMenuItem` has no `danger` variant, so the vault menu sets `text-danger focus:bg-danger-soft` itself. A shared variant would be tidier.

## Decisions

- Client uploads now get an index row (`shared_with_client = false`), so that From and Replaced work for the client's files. Staff still see them only once the step is released (the existing `stepReleasedForViewer` rule). Clients' own document lists are unchanged, because they read shared rows only.
- Delete is a soft delete. That makes Undo real and keeps the object in S3.
- The demo-only parts (P-434, P-454, P-470, P-474) follow the existing `NEXT_PUBLIC_DEMO_LOGINS` switch, so production never claims sample data.

## Checks

- `npx tsc --noEmit -p .`: no errors in my files. The errors that remain are in `app/api/dev/connections/route.ts` and `src/lib/firm-settings/firm-settings.ts`, which belong to other agents.
- `npx vitest run` on `src/components/auth`, `src/components/marketing`, `src/views/vault` and both documents repository tests: 110 passed.
- `npx eslint` on my files: 0 errors and 3 warnings, all of them from before this round.
