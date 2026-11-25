# MCA lookups (FalconeBiz)

## What the DIN lookup is

`/app/{admin,manager,lead}/tools/din-lookup` takes an eight-digit DIN and shows the MCA
director master record for it. The page is the one view for every staff role
(`src/views/tools/DinLookupView.tsx`); the client portal does not have it. It sits in the
sidebar under Registrations, next to GST Lookup.

The browser never talks to the provider. It posts `{ din, refresh }` to
`POST /api/tools/din-lookup`, the route calls FalconeBiz server-side with the API key, and
only the normalised record comes back.

## The provider call

`GET https://www.falconebiz.com/api/director_details` with three headers:

| Header | Value |
|---|---|
| `Authorization` | `FALCON_API_KEY` — the raw key, no `Bearer` prefix |
| `Din` | the eight digits |
| `Domain` | `falconDomain()` — see below |

**Only the key must be set**; without it the route answers 503 and says so. The `Domain` header
is how the provider ties a key to a licence: it is the domain the call is made from, not a
website the firm has to own separately. `src/lib/din-lookup/provider.ts` takes it from
`FALCON_API_DOMAIN` when that is set (a pasted URL is tolerated) and otherwise from the host
the Suite serves itself on (`SITE_URL`, so `app.sbctrack.in` in production, `localhost` in
development). So nothing has to be configured for it, and `FALCON_API_DOMAIN` is only needed
when FalconeBiz has a different domain on file than the one the app runs on. When the provider
rejects the call, the error names the domain that was sent, so the mismatch is visible.

The endpoint can be overridden with `FALCON_DIRECTOR_API_URL`; the default is the documented
URL above. The same key and domain will serve the company master-data lookup when that is
built, which is why the variables are named `FALCON_*` and not `DIN_*`.

The timeout is 30 seconds, because the provider reads MCA live and MCA is often slow.

## What MCA gives, and what it does not

Comes back: `din`, `name`, `din_status` (Approved, Deactivated, Disqualified, …),
`approve_date`, `dir3_kyc` ("Done" / "Not Done"), `updated_at` (when the provider last
refreshed its copy), and `association[]` — every company and LLP the person is on, each with
`cin` (LLPIN for an LLP), `com_name`, `designation`, `appointment` and `entity_type`.

Does **not** come back, and is not available from any provider because MCA does not publish
it: PAN, Aadhaar, date of birth, father's name, address, phone, email, nationality, passport,
qualification, occupation. So this tool verifies a DIN and lists appointments; the personal
details a DIR-3 KYC or SPICe+ filing needs still come from the client's own file. The page
says so in its last card, so nobody expects the form to fill itself.

## Normalising

`src/lib/din-lookup/normalize.ts` is pure and tested (`normalize.test.ts`). It unwraps a
`data` / `result` envelope if the provider adds one, reads each field through a few spellings,
turns DD/MM/YYYY into YYYY-MM-DD, drops association rows with neither a number nor a name,
drops a repeated row, and sorts newest appointment first. `entityType` falls back to the shape
of the number when the provider leaves it out: a CIN starts with a digit after `U` or `L`, an
LLPIN starts with three letters. The view splits the rows into Companies and LLPs.

Field coercions (`str`, `asStringArray`, `parseIndianDate`) live in `src/lib/lookup/fields.ts`
and are shared with the GST lookup.

## The second source: the MCA portal in the person's own session

The page has two buttons. **Search** uses the FalconeBiz API and needs no MCA login. **Read
from MCA** asks the VCFO Assist extension to read the record inside the person's own logged-in
MCA tab. That is route R1 of `docs/specs/mca-connect/HANDOFF.md`: the Suite never signs in to
MCA, never holds an MCA password and never answers a captcha or an OTP. MCA has no API and its
master-data pages are captcha-gated against automation, so this is the only shape the firm's
own rules (owner rule 3) allow.

Routes are in `app/api/tools/din-lookup/mca/route.ts`: POST opens a request, GET `?pending=1`
is what the extension picks up, GET `?id=` is what the page polls, and PATCH is how the
extension reports back — `state: 'running'`, then either the captured `director` or
`state: 'failed'` with a reason. Queue table: `mca_din_requests`. A request belongs to the
person who made it and lives 15 minutes; another signed-in person reading or answering it gets
404, because the extension always acts from that person's own browser. The whole path is behind
`VCFO_ASSIST_ENABLED`, the same flag as the rest of Assist, and answers 503 when it is off —
the page then says so and points at the API path, which needs no MCA login.

The captured payload, and what is still open before any of it can run against the live portal:
`docs/specs/mca-connect/DIN-CAPTURE.md`. The extension half is **not** built: its selectors
need the live MCA pages, and owner rule 2 holds that behind the CS opinion.

## Cache

`din_lookup_cache` (migration `0073_lookups_gst_and_din`, additive: it adds the GST and DIN caches and the request queue) keyed by DIN, with the
normalised record as `jsonb`, the `source` it came from (`falcon` or `mca-portal`), `fetched_at`
and `fetched_by`. Reads inside 24 hours come from Postgres whichever source filled them; the
Refresh button posts `refresh: true` and goes to the provider. MCA master
data is public, so the cache is deliberately not tenant-scoped — any staff member who may use
the tool may read any cached DIN — but the fetch is still attributed to a person. A cache read
or write that throws never fails the lookup, so the tool works before the migration is applied.

## Errors the page can show

- 400 — the DIN is not eight digits (also checked in the browser before the post).
- 404 — the provider has no director for that DIN, or returned an empty record.
- 502 — key or domain rejected (401/403), rate limited (429), credits exhausted (the provider
  reports its own failures inside a 200 with an `error` or `message` field), or a timeout.
- 503 — `FALCON_API_KEY` is missing.

## The report

The page lays out what the MCA report "View Director / Designated Partner Details" lays out,
without the portal's chrome: a details card (DIN/DPIN, name, and from the API path the DIN
status, approval date and DIR-3 KYC), then **Associated companies**, then **Associated LLPs**.
Each table carries the report's own columns — CIN/FCRN or LLPIN, name, status, designation,
category of appointment, original date of appointment, date of appointment at the current
designation, date of cessation.

Two things the page does that the portal does not. A column is only drawn when some row has a
value for it, so the API answer (which has fewer columns) does not show a wall of dashes. And
standing appointments are listed first, with ceased ones under a "Ceased appointments" heading,
newest ending first — the MCA report mixes them in one table and leaves the reader to scan the
cessation column. Company status is a chip: green for Active, red for Strike Off and the other
closed states.

**Print** uses the browser's own print, with the print block already in `app/globals.css`: the
sidebar, top bar, search row, source chips and the Ask VCFO launcher drop away, and a heading
with the DIN, the name, the source and the time read is added for the printed copy only.

## The checklist's "Check with MCA"

`DinCheckControl` (step `pre-15`, Proposed directors, DR-01) has a **Check with MCA** button
beside the status select. It calls `POST /api/tools/din-lookup` for the DIN the client typed
and shows, on the card: the MCA name, the DIN status, DIR-3 KYC, how many current appointments
MCA holds, and whether the name matches the one in the checklist.

The name comparison is `src/lib/din-lookup/name-match.ts`. MCA prints one upper-case string in
no fixed order, so the comparison is on the set of words, not the string: a different word
order is a match, an extra middle name or an initial standing for a word is "close", and
anything else differs.

It records nothing by itself. The lead presses **Record as verified** or **Record as mismatch**,
and a mismatch carries the difference into the mismatch note. That is firm policy
SBC-STD-AI-02: the tool prepares, the person decides. MCA publishes no date of birth or
father's name, so the card says those still want a look at the portal.

## Still to do

- The extension half of the MCA-session path (see above).
- The company master-data lookup by CIN. FalconeBiz serves it under the same key and domain,
  which is why the env vars are named `FALCON_*`.
