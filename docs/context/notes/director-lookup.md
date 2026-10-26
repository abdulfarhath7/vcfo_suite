# Director lookup by DIN

Code: `src/lib/director-lookup/` (types, DIN parsing, providers) and
`src/lib/ask/director-answer.ts` (chat reply + history filter). Wired in
`src/lib/ask/pipeline.ts` step 3a.

## Why MCA itself is not a source (checked 2026-10-23 / 2026-10-26)

- mca.gov.in answers **403 to any program** (see `ask-feeds.md`).
- The director search ("View Director Master Data") is a public, free page,
  but it sits behind a **captcha** and a session. Solving a captcha by machine
  is exactly what it exists to stop.
- MCA publishes **no self-serve API** for private firms. Third-party vendors
  claim "direct MCA access"; at least one vendor says MCA21 API access is
  limited to government and regulated integrations and that the portal's terms
  forbid scraping. Treat every vendor's data-source claim as unverified until
  their contract says where the data comes from.

So: free + live + automated is not on offer. The choices are a paid vendor
(automated, live-ish, per-call cost) or a human checking MCA (free, live,
manual). `DIN_LOOKUP_PROVIDER=off` is the second one.

## Rules this feature keeps

- **No model call.** A DIN and a director's name are personal data that must
  not reach the model (ASK-VCFO-CONTEXT rule 9, DPDP). The reply is built in
  code; `withoutDirectorLookups` keeps DIN turns out of later model history.
- **Staff only.** A client message with a DIN takes the normal guarded road.
- **Source + time on every reply.** Demo data says "not from MCA".
- `mock` is ignored when `NODE_ENV=production`.
- The reply *is* stored in `ask_messages` (our own database) so the thread
  can be reopened — that is personal data at rest, same as the KYC sheet.

## Adding a paid vendor

1. Add a provider in `providers.ts` that calls the vendor with a timeout and
   maps its JSON onto `DirectorRecord` (`dinStatusIsActive` reads status text).
2. Key in env (`DIN_LOOKUP_<VENDOR>_KEY`), never in the client bundle.
3. Add a fixture test with a real (redacted) vendor response.
4. Then: a DB cache (one paid call per DIN per day) and an audit row per lookup
   (who looked up which DIN, when) — both behind the repository seam.
