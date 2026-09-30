# 00 — What exists today

## The gap, precisely

A Project Lead fills engagement data into VCFO Suite. To file with MCA they then
retype the same data into the portal. VCFO Assist can fill the portal — but only
from a JSON profile pasted into its popup by hand. Nothing carries Suite's data to
Assist.

Verified in both repos:

- `vcfo_assist/extension/popup/popup.js` reads `#profile` (a textarea), parses it,
  stores it in `chrome.storage.local`, and sends it to the content script. There is
  no `fetch`, no Suite origin, no network code of any kind.
- `vcfo_suite` has no route, lib, or component mentioning Assist. `grep -ril assist`
  across `src/` and `app/` returns one unrelated match in `SbcLogo.tsx`.

So the answer to "how is the data being taken from Suite" is: it isn't. This pack
builds that path.

## What Assist does today, and keeps doing

```
popup textarea (pasted JSON)
      │
      ▼
chrome.storage.local  →  lib/mapping.js  →  content/filler.js  →  MCA form
```

`mapping.js` turns the profile into `[{ key, value, instance?, waitForOptions? }]`
per form. `key` is the semantic class MCA's AEM Adaptive Forms put on each
`.guideFieldNode` — `proposedname1`, `type-of-company`, `din7a`. Those were captured
from the live portal into `extension/schemas/*.compact.json`.

None of this changes. The bridge replaces only the first box.

## What Suite already has, and why that makes this small

`src/lib/doc-pack/` is a pure read model over `checklist_state`. It exists because
the docx generators needed the same facts, and it is tested. It already resolves:

| Need | Existing resolver |
|---|---|
| Approved or proposed company name | `resolveProposedCompanyName(pre5, pre1, engagement)` |
| Registered office | `resolveRegisteredOfficeResponses(pre6, pre8, pre14)` |
| Directors | `proposed-directors.ts` → `ProposedDirector[]` with `values` |
| Parent entity | `resolveParentEntityName` / `resolveParentEntityAddress` |
| All of pre1/5/6/7/8/14 responses in one object | `buildDocPackContext(input)` |

This is a mapping job, not a data-modelling job. If you find yourself reading
`checklist_state` directly, stop — the resolver you want already exists.

## Why the missing-input pattern is copied too

`doc-pack` does not just return data; it returns what is missing, with the `stepId`
and `tabId` that would fix it. The Assist profile must do the same. A lead who gets
a half-filled MCA form needs to know which Suite step is blank, not that "some
fields were empty".
