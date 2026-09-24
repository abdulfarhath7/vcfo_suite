# Source workbooks — reference for the doc-gaps work

Extracted 2026-09-24 from the three spreadsheets the owner attached at the repo
root. Personal data (names, PAN, Aadhaar, DIN, email, mobile, addresses) is
**redacted** here — the originals stay out of git. Read this alongside
`DOC-GAPS-CONTEXT.md` and `docs/doc-gaps/DISCOVERY.md`.

| File | What it is | Use for |
|---|---|---|
| `Incorporation Excel (2) (1).xlsx` | The firm's master workbook: one MASTER DATA sheet that auto-fills every per-director document | **Primary spec** for MBP-1, EPFO specimen card, shares subscribed (§1–§3 below) |
| `SPICe-Requirements.xlsx` | Export of this repo's own checklist catalog (steps, fields, uploads), generated 2026-09-23 from `src/data/checklist.ts` + `src/lib/checklist-responses.ts` | Cross-check of field ids / step ids; not a new requirement |
| `MCA-SPICe-Portal-Fields.xlsx` | Every field, attachment and declaration on the MCA V3 portal (SPICe+ A/B, AGILE-PRO-S, INC-9, INC-33 e-MOA, INC-34 e-AOA), captured 2026-09-23 | Out of scope for doc-gaps; relevant to the VCFO Assist profile export |

---

## 1. Incorporation workbook — MASTER DATA (inputs)

**Company block**

| Workbook label | Example value | App source today |
|---|---|---|
| Proposed Company Name | `<name> Private Limited` | `pre-5` approved name / `pre-1` proposed names |
| Type of Company | Private Company | `pre-1` |
| Registered Office Address (full), City, State/UT, PIN | Hyderabad, Telangana | `pre-14` |
| Email ID (Company), Phone No. | — | `pre-14` / `pre-1` |
| Authorized Capital (₹) | 1,000,000 | `pre-13` / `pre-1` |
| Paid-up Capital (₹) | 100,000 | `pre-13` / `pre-1` |
| No. of Equity Shares | 10,000 | `pre-13` |
| Face Value per Share (₹) | 10 | `nominalValuePerEquityShare` |
| Main Object / Industry | Software | `pre-1` |
| Subscription Amount (₹) | 100,000 | derived (shares × face value) |
| Bank Name for Deposit | blank | not captured — not needed by any A–D document |

**Director block** (Director 1, Director 2, Director 3 optional)

Full name · Father's name · DIN · DOB · PAN · Aadhaar · Nationality · Occupation ·
Residential address, City/District, State, PIN · Email · Mobile ·
**Designation** (example: "Director") · **No. of Shares Subscribed** (example: 1 each) ·
No. of directorships (existing) · No. of MD/WTD/CEO/CFO/CS roles.

All already captured in `pre-15` **except** Designation and No. of Shares
Subscribed (verify in DISCOVERY §2–§3).

**Signing block:** Date of Signing · Place of Signing → `pre-7`
`incorpDocsSigningDate` / `incorpDocsSigningPlace`.

> Data note for the owner: the example has 2 directors subscribing 1 share
> each (2 shares, ₹20) but 10,000 equity shares / ₹100,000 paid-up. Either
> the example is incomplete or the remaining shares go to someone not listed.

---

## 2. MBP-1 sheet (gap A)

Layout, top to bottom:

1. `FORM MBP-1 — Notice of Interest`
2. `Section 184(1) & Rule 9(1) — Companies Act, 2013`
3. **Notice to** — Company Name
4. **Director details** — Director Name · Father's Name · Residential Address · Designation
5. **Interest / concern table** ("fill manually") — "List all companies/firms/LLPs in which the director has interest or concern":
   `Sl.No. | Name of Company / Body / Firm | Nature of Interest | Shareholding | Date of Interest` — 10 blank rows
6. Signature line, then Name · DIN · Date · Place
7. Footnote: "MBP-1 must be submitted at first Board meeting after appointment."

Workbook bug: the Dir1 sheet has broken cell references (Director Name shows
`0`, Designation shows the email, DIN shows the name). The Dir2 sheet is
correct. Treat Dir2 as the spec.

The workbook fills the interest table by hand; the app can pre-fill it from
`pre-15` other-company interests and fall back to a single `NIL` row.

---

## 3. Specimen Signatures sheet (gap B)

1. Title: `SPECIMEN SIGNATURE CARD FOR UPLOAD WITH THE ONLINE APPLICATION FOR REGISTRATION WITH EMPLOYEES' PROVIDENT FUND ORGANISATION`
2. Subtitle: `(This card is for the specimen signature of the employers of the establishment at the time of registration of the establishment with the Employees' PF Organization)`
3. **Establishment details** — Name of Establishment · Address of Establishment
4. `(Please upload for all employers and for Authorized Signatory if any)`
5. Name of the Employer · Designation
6. Specimen Signature — three numbered boxes (1, 2, 3)
7. `For PF Office Use —`

The workbook has one card (Director 1). "For all employers" implies one card
per director.

---

## 4. Other workbook sheets (already built — reference only)

DIR-2, DIR-8, INC-9, ID & Address Declaration, Deposit Declaration — one sheet
per director. Wording matches the existing templates in `public/templates/`.
Workbook quirks not to copy: DIR-8 uses "son of" regardless of gender; Dir2's
ID & Address sheet repeats Dir1's address (copy-paste bug); Deposit Decl Dir2
address cell is broken.

---

## 5. SPICe-Requirements.xlsx — facts relevant to doc-gaps

- `pre-16` Subscriber Details repeat group `subscribers[]`: `type`
  (individual / non-individual), `entityType` (body-corporate / llp), `name`,
  `cin`, `address`, `llpin`, `authorisedPerson`, `shares`, `shareValue`
  (both text). Min 0, max 50. Step-level: `shareholderAuthorizedPerson`,
  `shareholderNominee` (INC-35). Step copy: "Optional: submit with none if the
  proposed directors subscribe the initial shares themselves."
- `post-1` First Board Meeting fields: `boardMeetingAgenda`,
  `boardMeetingMinutes`, `stepRemarks` — **no meeting date field**.
- `reg-1` PF Registration fields: `pfRegistrationNumber`,
  `pfRegistrationDate`, `dscEsignCredentialsNotes`, `stepRemarks`.
- The "Other Docs — Doc Pack" sheet lists the MOA/AOA subscription sheets as
  "foreign subscriber format" only — confirms gap C.
