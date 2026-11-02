# Overnight M4 and M5: client Documents table and Ask VCFO chat (30 Oct 2026)

Branch `ovn/m3`. The owner approved these items. The checks were `npx tsc --noEmit -p .`, `npx eslint` on the changed files and `npx vitest run` on the related tests. Nobody ran the app, a browser or a screenshot test (owner rule).

## Next actions for the owner

| No. | Action | Status |
|---|---|---|
| 1 | Open `/app/client/documents` as a client on a desktop. Check the table in light and dark mode. | ✗ Not done (owner) |
| 2 | Open Ask VCFO as staff and as a client. Click Small, Large and Side panel. Click "Open full page". | ✗ Not done (owner) |
| 3 | Decide if the past-chat list must come from the server (see F4, TODO). | ✗ Not done (owner) |

## M4 E1: "All documents" card

| Item | Result | Status |
|---|---|---|
| Card | The card has one flat table. It has no inner cards and no preview pane. | ✓ |
| Columns | File badge (`FileBadge`) · name · folder · from · date · status chip · row menu. | ✓ |
| Filter chips | All · Waiting on you · From SBC · Signed. Each chip shows its count. | ✓ |
| Waiting on you | Shows open requests (missing files). | ✓ |
| From SBC | Shows files that SBC sent. | ✓ |
| Signed | Shows signed copies. The repository sets the new optional `DocNode.signed` flag for checklist fields that end in "Signed" and for the signed board resolution. No schema change. | ✓ |
| Groups | One thin header row for each top folder (phase in "By step", category in "By category"). Click the header to fold the group. | ✓ |
| One line | Each document has one line. Secondary text (file name, "Replaced", "Older than 2 months", the SBC note) is in faint ink. | ✓ |
| Preview | Click the name, or use "Preview" in the row menu. The shared viewer opens. | ✓ |
| Download | Row menu "Download". Group menu and row menu "Download folder as ZIP". Toolbar "Download all (ZIP)". | ✓ |
| Upload | Click a missing row, use the row menu "Upload", drop a file on a missing row, or use the toolbar "Upload · N requested". | ✓ |
| Request | Missing rows come from the open requests. The upload goes to that request. | ✓ |
| Other actions | "Open step N", "Verify on <portal>", "Copy link", "Copy link to folder", "Replaced" toggle, filter field, "By step · By category". | ✓ |
| Deep links | `?doc=` selects and scrolls to the row. `?folder=` opens the group and scrolls to it. A new upload row glows once. | ✓ |
| Data | Same sources: `GET /api/client/documents` and the shared step model. | ✓ |
| Removed | The tree, the preview pane and the "Status" icon toggle. The status chip column replaces the status icons. | ✓ |
| Narrow screens | Under 1100 px the "From" column hides. Under 860 px the "Folder" column hides. Phones (under 700 px) keep the phone board. | ✓ |
| Staff lists | The staff vault does not use this component. It did not change. | ✓ |
| Test | `model.test.ts`: chip order, chip rules, grouping. | ✓ |

## M4 E2: open-folder view

| Item | Result | Status |
|---|---|---|
| Drill-down | `Drill.tsx` did not change. The group count ("3/5") and the folder cell open it. | ✓ |

## M5 F1: dark mode

| Item | Result | Status |
|---|---|---|
| Staff pop-up | The question bubble uses `brand-soft` and `ink` (not `navy-fill`, which turns light in dark mode). | ✓ |
| Sidebar button | `text-white` and `bg-white/[.07]` changed to `side-ink`, `on-brand` and `side-hover`. | ✓ |
| Client pop-up | `#vp-chat` in `21-runtime.css` has no literal colours now. Head, bubbles, buttons, input, cards and scrim use `surface`, `line`, `ink`, `brand` and `scrim` tokens. | ✓ |
| Tokens and primitives | No edit to `app/globals.css` or `src/components/ui/*`. | ✓ |

## M5 F2: avatars

| Item | Result | Status |
|---|---|---|
| Answer avatar | The VCFO mark (`/client-portal/vcfo-mark.webp`) sits beside each answer. It is the mark, not the Visor figure (C-0003, R-04). | ✓ |
| Question avatar | The person's initials (`user.initials`) sit beside each question. | ✓ |
| Both pop-ups | Staff: `AskAvatar` and `AskUserBubble`. Client: CSS marks on `.vpc-a`, `.vpc-card` and `.vpc-u[data-initials]`. | ✓ |

## M5 F3: pop-up sizes

| Item | Result | Status |
|---|---|---|
| Sizes | Small 380 × 560. Large 520 × 720. Side panel: full height, 440 px wide, at the right edge. | ✓ |
| Buttons | Three icon buttons in the head (`aria-pressed`). | ✓ |
| Saved | `localStorage` key `vcfo.ask.size.<userId>` (`useAskPanelSize`). The staff and the client pop-ups share it. | ✓ |
| Animations | The open and close animations did not change. | ✓ |
| Phones | Under 640 px (staff) and 768 px (client) the chat stays full screen. The size buttons hide. | ✓ |

## M5 F4: full chat page

| Item | Result | Status |
|---|---|---|
| Routes | `/app/client/ask`, `/app/intern/ask`, `/app/manager/ask`, `/app/admin/ask`, `/app/super/ask`. | ✓ |
| Developer | No page. Ask VCFO is off for the developer (`canUseAsk`). | ✓ |
| Layout | Past chats on the left. The conversation on the right with the same thread, answer cards and composer. "New chat" starts a new chat. | ✓ |
| Open full page | A head button in both pop-ups. It closes the pop-up and opens the page. The provider keeps the same conversation. | ✓ |
| Pop-up on the page | The pop-up hides while the page is open (`pageOpen`). | ✓ |
| `/app/admin/ask-vcfo` | Not changed. It still opens the sources and gaps pages. | ✓ |
| TODO: chat list | No server list of conversations exists. The list is in `localStorage` (`vcfo.ask.history.<userId>`, 40 chats). The messages load from `/api/ask/conversations/[id]`. Add a server list endpoint later. | ✗ |
| Client limit | In the client pop-up, the suggested questions are answered by `/api/client/portal/answer`. These answers are not in the Ask thread, so the full page does not show them. Typed questions do show. | ✗ |
| Breadcrumb | `shell-crumbs.ts` names the `ask` segment "Ask VCFO". | ✓ |

## M5 F5: every page and the command bar

| Item | Result | Status |
|---|---|---|
| Pop-up | It stays on every dashboard page (staff `AskShellMount`, client portal shell). | ✓ |
| Command bar | "Open Ask VCFO" is the first Pages entry in the staff `CommandPalette` (Ctrl K) and in the client `SearchPalette` (Ctrl K), when Ask VCFO is on. | ✓ |

## Checks

| Check | Result | Status |
|---|---|---|
| `npx tsc --noEmit -p .` | No errors. | ✓ |
| `npx eslint` (changed files) | No errors. Warnings are the usual `react-refresh` page-metadata warnings and two old unused imports. | ✓ |
| `npx vitest run` | `src/components/ask`, `tests/ask` (mock evals), `src/components/shell`, `src/components/client-portal`, `src/lib/ask`, `src/lib/auth-routes`, `src/db/repositories/client-documents`: all pass. New tests for sizes, avatars, the full page and the role paths. | ✓ |
| Schema | No schema change. No migration. | ✓ |
