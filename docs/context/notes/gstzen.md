# GSTZen (GST returns, consent OTP, notices, GSTIN check)

Card agents work stream B, built 26 Nov 2026 on the foundation commit 45fa822. The spec is
`docs/specs/live-portal-browser/GSTZEN.md`; screens 7 and 8 of `MASTER-PLAN.md`; decisions B5 and B7.
API shapes come from https://my.gstzen.in/docs/api/ as read on 26 Nov 2026. Nothing has been run
against the live GSTZen API: there are no credentials, and every test uses a mocked fetch.

## Where things are

- `src/lib/gstzen/client.ts` is the only code that calls GSTZen. Server-only. It signs in with
  `GSTZEN_USERNAME` / `GSTZEN_PASSWORD` (form-encoded, `/accounts/api/login/token/`), keeps the JWT in
  process memory until ten minutes before its expiry (24 hours), signs in again once after a 401, and
  never logs. The GSTIN validator uses its own `Token` header with `GSTZEN_API_TOKEN`; without that
  token it falls back to the JWT validator (`/api/j/gstin-validator/`).
- `src/lib/gstzen/gate.ts`: a route is open only when GSTZen is configured, the kill switch is off and
  the admin switch (`agent_settings.gstzen`) is on for the user. Routes that would call GSTZen answer
  503 with the reason. A client answering an OTP is checked against the staff member who asked for it.
- `mappers.ts` (pure, tested) turns portal JSON into Suite's numbers; `run-state.ts` (pure, tested) is
  the return run state machine, the steps strip and the next step; `work.ts` is the slow work the
  `gst-return-work` job runs; `returns.ts` holds the card actions and the EVC filing; `otp.ts` the
  consent request and the one OTP answer path; `notices.ts` the notice sync and the GSTIN check.
- Repositories: `gstn-sessions.ts`, `gst-returns.ts`, `agent-otp.ts`, `gst-notices.ts`, and the shared
  scope helper `gst-agent-scope.ts` (staff on the engagement; clients only for their own OTP requests).
- Routes: `app/api/gstzen/{status,consent,otp/[id],returns,returns/[id],notices,gstin-check}` (staff)
  and `app/api/client/agent-otp` and `/[id]` (client).
- Jobs: `gst-return-work` (event `gstzen/return.work`), `gstn-session-refresh` (every 15 minutes) and
  `gst-notices-daily` (07:47 India time).
- UI: `src/components/card-agent/bodies/ApiFileBody.tsx` (screen 7), `src/components/gstzen/` (the OTP
  box, the notices section, the GSTIN check), the client home card `YourTurnCard.tsx` (screen 8), and
  "Check on GSTN" plus GST notices on the GST registration tracker's outcome tab (staff only).

## Gotchas

- **OTPs never leave the request.** The consent OTP and the EVC OTP go to GSTZen inside the request
  that carries them. They are not put on an Inngest event (events are stored), not audited and not
  held in React Query (the box posts with a plain `fetch` and clears itself). This is why the EVC
  filing runs in the request and not in the job.
- **The session lifetime.** The docs disagree with themselves: the diagram says 6 hours active, the
  refresh text says refresh about 15 minutes before "24 hours less 15 minutes", and the sample answer
  has `expiry: 43200`. Suite stores `expiry_time` as the moment the session goes inactive and the
  refresh job refreshes any active session that goes inactive in the next 30 minutes, for up to 30 days
  from consent. Check this against GSTZen once there is a sandbox.
- **The GST portal username** is read from the credentials workbook's GST login row (never the
  password). The workbook fills that cell with the GSTIN until someone types the username, so a value
  equal to the GSTIN is treated as missing and the person is asked to type it; a typed username is
  used for that one call and not stored.
- **A GSTIN not in the GSTZen account.** When generate-OTP answers "not found in your account", Suite
  adds the GSTIN once with Create GSTIN (`taxpayer_type: REGULAR`, the company name) and asks again.
  The plan limit seen in the docs is 25 GSTINs.
- **EVC OTP payloads differ by page.** The GSTR-3B page shows `fp`, the GSTR-1 page `ret_period`;
  the client sends both. GSTR-9 and 9C have their own EVC OTP endpoints because the portal ties the OTP
  to the form. GSTR-1 RETFILE forwards RETSUM's `data_json_string` unchanged; GSTR-3B, 9 and 9C send
  `json_data` (the RETSUM `data`, the GSTR-9 records with `isnil: "N"` and a zero 30002 offset, the
  saved 9C).
- **GSTR-3B save** is built from AUTOLIAB (`r3bautopop.liabitc`): 3.1(a)-(e), 3.2 by place of supply,
  4A(1)-(5) less 4B. Suite does not upload its own sales; the portal's own figures are the return.
- **The offset** follows section 49 and rule 88A: IGST credit first (IGST, then CGST, then SGST), then
  CGST credit (CGST, then IGST) and SGST credit (SGST, then IGST); cess only against cess. Reverse
  charge, interest and late fee are cash. Cash cannot move between heads, so the cash still to pay is
  counted per head. If the ledger is short, the offset job stops and the card asks the person to pay
  (PMT-06 from their own bank) and read the balance again. Amounts keep paise; check with GSTZen
  whether the portal wants whole rupees in `pdcash`.
- **`tx_pmt.tx_py`** can read zero before the portal computes; the liability then comes from table 3.1.
- **GSTR-1** uploads nothing: the save step reads the portal's RETSUM and the e-invoice count; proceed
  to file freezes it; the RETSUM after proceed carries the string to sign.
- **GSTR-9C** cannot be saved by Suite (the audited figures are the auditor's). The card reads the
  GSTR-9 figures and the saved 9C; until the 9C is saved on the portal it says so and offers a re-read.
  EVC filing is in the docs and is offered once the 9C is saved.
- **DSC filing** needs a SHA-256 signature made by the signer's own DSC token; the card shows "Sign
  with DSC (coming)" and offers the EVC.
- **The ARN write-back** reuses the compliance filing path: `markFilingFiled` (filed on, note with the
  ARN, audit and filing event) and `upsertFilingDetails` (`acknowledgementNo`, `filedBy`). A client's
  EVC answer writes the filing as the staff member who started the run. GSTR-9C has no calendar
  obligation, so only the run holds its ARN.
- **Notices** only list the last 60 days. The open and replied lists are not released by the portal
  yet, so Suite uses the full list and calls a notice open while `dateOfRespond` is `NA`. Document
  bodies are never fetched or stored.
- **Local dev**: Turbopack refuses a worktree whose `node_modules` is a symlink; use
  `npx next dev --webpack`. Without an Inngest dev server, `inngest.send` throws and the work runs in
  the request's process (`runWorkInline`), as Ask's fill does.

## Configuration (stream C adds these to App Runner and Secrets Manager)

| Name | Kind | Note |
|---|---|---|
| `GSTZEN_BASE_URL` | env | Default `https://my.gstzen.in` |
| `GSTZEN_USERNAME` | env | The firm's GSTZen login (not a GST portal login) |
| `GSTZEN_PASSWORD` | secret | Secrets Manager |
| `GSTZEN_API_TOKEN` | secret | The GSTZen API key for the GSTIN validator; optional (the JWT validator is used without it) |

The admin also switches the route on in Settings > Agents (`agent_settings.gstzen.live`).
