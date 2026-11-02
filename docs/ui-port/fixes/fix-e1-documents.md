# Fix E1: client Documents page (31 Oct 2026)

The owner wanted the folder tree on the left, as before 30 Oct, but simpler and without cards.
Commit f064130 removed the tree and put a flat table in one card. This fix puts the tree back.

| Status | Part | What changed |
|---|---|---|
| ✓ | Folder tree | The left side panel is back. Folders open and close. The keys, the selection and the folder menus work as before. |
| ✓ | Preview pane | The pane is back on the right. It shows the selected file, its status, Step, From, Date, File, Note and Verify. |
| ✓ | No cards | The toolbar, the tree and the pane sit on the page background. The outer card is gone. |
| ✓ | One line | One 2 px line separates the tree from the pane. No other part has a frame. |
| ✓ | Document rows | Each document uses one line. The secondary text uses faint ink. A status chip shows at the end of the line. |
| ✓ | Filter chips | All, Waiting on you, From SBC and Signed stay above the tree. Each chip shows a count. |
| ✓ | Signed flag | The `signed` flag on `DocNode` stays. The Signed chip uses it. |
| ✓ | Actions | Preview, download, folder ZIP, upload, drop a file on a missing row, open step, verify, copy link and deep links stay. |
| ✓ | Open-folder view | `Drill.tsx` did not change. The progress bars in the tree open it. |
| ✓ | Narrow screens | Under 1000 px, the tree becomes a drop-down above the pane. Under 700 px, the phone board did not change. |
| ✓ | Tokens | The preview paper now uses tokens. The old literal colours are gone. Light and dark mode use the same tokens. |
| ✓ | Animations | All animations stay. The drop-down opens with a short fade. |
| ✓ | Tests | `treeRows` replaces `groupEntries`. `model.test.ts` tests the tree rows and the chips. |
| ✗ | Loading skeleton | `States.tsx` still draws the loading, empty and error states in a card. Change it in a next fix if the owner wants. |
| ✗ | App run | The owner rule says do not run the app. Only typecheck, lint and unit tests ran. |
