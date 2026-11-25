# DIN capture: reading a director's MCA record in the person's own session

Written 25 November 2026. The Suite half is built on branch `feat/gst-lookup`. The extension
half is **not** built, because it cannot be written without opening the live MCA portal, and
owner rule 2 of `HANDOFF.md` forbids that before written CS approval.

## Why this exists

The owner asked for this: a person enters a DIN in `app.sbctrack.in` and the director's MCA
details appear in the Suite, with the MCA login being the only manual step.

Two facts shape the answer.

| Fact | Where it comes from |
|---|---|
| MCA publishes no filing or lookup API. | `research_notes/.../official_channels_and_data_apis.md` |
| The V3 master-data pages are captcha-gated, described as being so "to prevent automated scraping". | same note, citing the cspratik guide |
| Captcha and OTP bypass, stored third-party logins and private portal endpoints are prohibited. | owner rule 3, `HANDOFF.md` |
| The chosen route is R1: the extension fills and reads inside the person's own logged-in session and stores no credentials. | "The chosen route", `HANDOFF.md` |

So the Suite does not sign in to MCA, does not hold an MCA password, and does not solve a
captcha. The person signs in once in their own browser; the extension does everything after
that. That is the only shape of "the rest is automated" that the firm's own rules allow.

Note that for DIN data specifically there is already a path that needs no MCA login at all:
the FalconeBiz `director_details` API (`docs/context/notes/mca-lookup.md`). The portal path
matters when the firm wants the record read from MCA itself rather than from a data vendor.

## The flow

| Step | Who | What happens |
|---|---|---|
| 1 | Staff member | Types the DIN on the DIN Lookup page and presses **Read from MCA**. |
| 2 | Suite | `POST /api/tools/din-lookup/mca` opens a request row owned by that person. |
| 3 | Extension | `GET /api/tools/din-lookup/mca?pending=1` from inside the same signed-in Suite tab. |
| 4 | Extension | `PATCH { id, state: 'running' }`, then reads the director page in the person's own MCA tab. |
| 5 | Extension | `PATCH { id, director: {...} }` with what the page showed. |
| 6 | Suite | Normalises it, stores it with `source = 'mca-portal'`, marks the request done. |
| 7 | Page | Polls `GET ?id=`, shows the record with an "MCA portal" chip. |

A request lives 15 minutes and belongs to one person: another signed-in person reading or
answering it gets 404. The whole path is behind `VCFO_ASSIST_ENABLED`; with the flag off the
routes answer 503 and the page says so and offers the API path instead.

## The page the extension reads

MCA Services → Master Data → Master Data Services, with **Directors/Designated partners**
chosen, takes a DIN and lists the person; the DIN in that result opens **View Director /
Designated Partner Details** (`…/MDS/director-master-info.html?DIN=<opaque token>`). That
report, not the search page, is what the extension reads. Its parts, from a real report read on
25 November 2026 (DIN 06419899, "Director Master Info.pdf"):

| Report part | Fields |
|---|---|
| Details | DIN/DPIN, Name of Director/Designated Partner |
| List of Associated Companies | Sr No, CIN/FCRN, Company Name, Company Status, Designation, Category of appointment, Original Date of appointment, Date of Appointment at Current Designation, Date of cessation (if applicable) |
| List of Associated LLPs | Sr No, LLPIN, LLP Name, LLP Status, Designation, Original Date of appointment, Date of Appointment at Current Designation, Date of cessation (if applicable) |

Three habits of the report the parser must follow:

1. A dash means "no value", not a value. The Suite reads `-`, `--`, `NA` and `N/A` as empty.
2. The same company appears more than once when the person held two designations in it, each
   row with its own dates. Rows must not be collapsed by company.
3. A row with a cessation date is a past appointment. The Suite splits current from ceased on
   exactly that, and sorts the ceased by the date they ended.

The report carries no DIN status, no DIN approval date and no DIR-3 KYC state; those three come
from the API path only. A record read from the portal therefore shows the appointment tables in
full and leaves those three fields empty, which the page handles by hiding empty rows.

## The payload the extension must post

```json
{
  "id": "<request id>",
  "director": {
    "din": "06419899",
    "name": "AMEERUDDIN SYED",
    "association": [
      { "cin": "L72100TG1981PLC169991", "com_name": "MAGELLANIC CLOUD LIMITED",
        "company_status": "Active", "designation": "Whole-time director",
        "appointment_category": "Professional", "appointment": "03/02/2026",
        "current_designation_date": "03/02/2026", "cessation": "-",
        "entity_type": "company" },
      { "llpin": "AAE-5566", "llp_name": "NARAYANA ADVISORY LLP", "llp_status": "Active",
        "designation": "Designated Partner", "appointment": "20/07/2022",
        "cessation": "-", "entity_type": "llp" }
    ]
  }
}
```

The spelling is deliberately the FalconeBiz spelling where the two overlap, so one normaliser
serves both sources; the portal-only columns are added with the report's own names. `cin` and
`llpin`, `com_name` and `llp_name`, `company_status` and `llp_status` are interchangeable. Dates
may be `DD/MM/YYYY`, `DD-MM-YYYY` or ISO. `entity_type` may be left out; it is then inferred
from the number (an LLPIN starts with three letters). The API path may also send `din_status`,
`approve_date`, `dir3_kyc` and `updated_at`, which the portal report does not carry. The schema
is `src/lib/din-lookup/capture.ts`, and `src/lib/din-lookup/mca-report.test.ts` holds the real
report as a fixture.

**Any other key is dropped**, which a test enforces (`capture.test.ts`): a `password`, `otp`,
`captcha` or `cookie` field cannot reach the database even if a future extension build sent
one by mistake. Failures are reported as `PATCH { id, state: 'failed', error }`, so the person
sees why instead of waiting.

## What is still open before this can run

1. **The CS opinion** (owner rule 1 and 2). Reading a page in a person's own session is a much
   smaller act than filing, but it is still automated reading of a captcha-gated portal, so it
   belongs in the same opinion the plan already asks for.
2. **The extension side.** Selectors for the MCA director page cannot be written without
   opening the portal. Step 5 of `HANDOFF.md` covers that visit.
3. **Which MCA page.** The record the Suite expects matches "View director master data". If
   the firm wants signatory details or pending forms as well, the captured shape grows and
   `NormalizedDinData` grows with it.
4. **DPDP.** Director records are personal data. The cache keeps only what MCA publishes and
   no contact details, which keeps it inside the register-data argument in the legal review.
