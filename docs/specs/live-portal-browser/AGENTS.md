# VCFO Suite agents — full build plan

Written in ASD-STE100 style: short sentences, active voice, one instruction per sentence.
Read `PLAN.md` in this folder first. It describes the live browser that all portal agents use.

## 1. The answer in one table

| Layer | What it is | Count | Built today |
|---|---|---|---|
| Orchestrator | Selects the next filing. Starts the live browser. Assigns the work to an agent. | 1 | 0 |
| Domain agents | The robots that the user sees in Suite. | 4 | 4 (in the extension) |
| Helper agents | Work in the background inside Suite. They do not touch a portal. | 6 | 2 partly (Ask VCFO fill, GST readiness) |
| Portal packs | What the agents know about one government website. | 17 | 1 (MCA V3), 8 empty placeholders |
| Form recipes | The steps to fill one form on one portal. | 50 | 5 (MCA, beta, mock only) |

**Total: 11 agents (1 + 4 + 6), 17 portal packs and 50 form recipes.**

An agent is not one AI per form. A domain agent runs many recipes. A recipe is a fixed list of
fields and steps. The AI only finds a field when the portal changes (guard G10). This keeps the
cost low and the result the same each time.

## 2. How the parts connect

```
                         +-----------------------------+
   Checklist (34 steps)  |        ORCHESTRATOR         |   Compliance calendar
   Registrations (24) -->|  selects the next filing,   |<-- (due dates, monthly,
   Ask VCFO chat ------->|  checks readiness, starts   |     annual)
                         |  the live browser           |
                         +--------------+--------------+
                                        |
        +---------------+---------------+---------------+----------------+
        |               |                               |                |
 +------v------+ +------v---------+            +--------v------+ +-------v------+
 |INCORPORATION| |POST-INCORP.    |            |REGISTRATION   | |COMPLIANCE    |
 |agent        | |agent           |            |agent          | |agent         |
 |6 recipes    | |2 recipes       |            |24 recipes     | |18 recipes    |
 +------+------+ +------+---------+            +--------+------+ +-------+------+
        |               |                               |                |
        +---------------+-------------+-----------------+----------------+
                                      |
                  +-------------------v--------------------+
                  |  SHARED ENGINE (from the extension)    |
                  |  guards G1-G23 . heal ladder . recipes |
                  +-------------------+--------------------+
                                      |
                  +-------------------v--------------------+
                  |  LIVE BROWSER on SBC AWS (Mumbai)      |
                  |  one Chromium per filing               |
                  +-------------------+--------------------+
                                      | screen stream
                  +-------------------v--------------------+
                  |  USER'S BROWSER                        |
                  |  [ vcfosuite tab ] [ live portal tab ] |
                  |  user types: login, captcha, OTP,      |
                  |  presses Submit, signs DSC on own PC   |
                  +----------------------------------------+

   Helper agents (background, inside Suite, never on a portal):
   [Document collector] [Data checker] [Certifier prep]
   [Status tracker] [Portal healer] [Session manager]
```

## 3. The 11 agents

| # | Agent | Type | Job | Uses existing code |
|---|---|---|---|---|
| 1 | Orchestrator | Core | Selects the next filing from the checklist and the calendar. Checks readiness. Starts one live session. Gives the run to a domain agent. | `src/lib/checklist/`, `src/lib/compliance/`, Inngest `src/jobs/` |
| 2 | Incorporation agent | Domain | Runs the SPICe+ forms on MCA. | Extension recipes `spice-a`, `spice-b`, `agile-pro-s`, `emoa`, `eaoa` |
| 3 | Post-incorporation agent | Domain | Runs INC-20A and ADT-1. | Catalog tasks `inc-20a`, `adt-1` |
| 4 | Registration agent | Domain | Runs the 24 registrations (GST, PF, ESI and the others). | `src/lib/registrations/`, catalog group `registration` |
| 5 | Compliance agent | Domain | Runs the monthly, quarterly and annual filings. | `src/lib/compliance/`, catalog group `compliance` |
| 6 | Document collector | Helper | Gets the documents from the vault, SharePoint, Zoho or the client. Sends a request list for missing documents. | `gst-sourcing.ts`, `src/storage/`, SharePoint notes |
| 7 | Data checker | Helper | Finds missing or bad values before a run. Blocks placeholder values (G16). | `gst-readiness.ts`, extension `src/guards/placeholder.ts` |
| 8 | Certifier prep | Helper | Prepares the field-by-field check list for the certifier (G17). | `src/lib/assist-agents/attestation.ts` |
| 9 | Status tracker | Helper | Reads the ARN, SRN, TRN or acknowledgement. Writes it back. Sends reminders until approval. | `record-srn.ts`, `gst-assist.ts`, `gst-registration-start.ts` |
| 10 | Portal healer | Helper | Finds a field that moved after a portal change. Proposes a recipe patch for staff to approve. | Extension `src/heal/`, `src/lib/assist-agents/resolve.ts` |
| 11 | Session manager | Helper | Starts and stops the live browsers. Applies the time limits. Allows one run per portal login. | New (`PLAN.md`, phase 3 and 4) |

## 4. The 17 portal packs

| # | Portal pack | Website | Recipes that use it | Status today | Legal gate |
|---|---|---|---|---|---|
| 1 | MCA V3 | mca.gov.in | 13 | Built, mock only | CS questions 12 to 19 |
| 2 | GST | gst.gov.in | 6 | Empty placeholder | CS question 30. GST terms bar unofficial interfaces. A GSP API is the safe option. |
| 3 | Income tax | incometax.gov.in | 4 | Empty placeholder | CS question 24 |
| 4 | TRACES | tdscpc.gov.in | 1 | Empty placeholder | CS question 28 |
| 5 | Protean TIN | tin-nsdl / Protean | 2 | Empty placeholder | CS question 27 |
| 6 | EPFO | epfindia.gov.in | 2 | Empty placeholder | CS question 19 |
| 7 | ESIC | esic.gov.in | 2 | Empty placeholder | CS question 19 |
| 8 | Udyam | udyamregistration.gov.in | 1 | Empty placeholder | CS questions 11 and 19 (Aadhaar) |
| 9 | DGFT | dgft.gov.in | 1 | Empty placeholder | CS question 19 |
| 10 | ICEGATE | icegate.gov.in | 1 | Not started | New CS question |
| 11 | IP India | ipindia.gov.in | 3 | Not started | New CS question |
| 12 | RBI FIRMS | firms.rbi.org.in | 3 | Not started | New CS question |
| 13 | RBI FLAIR | flair.rbi.org.in | 1 | Not started | New CS question |
| 14 | LEI registrar | LEI issuer portal | 1 | Not started | New CS question |
| 15 | STPI | stpi.in | 1 | Not started | New CS question |
| 16 | Shram Suvidha (CLRA) | shramsuvidha.gov.in | 1 | Not started | New CS question |
| 17 | State portals | One pack for each state (PT, S&E, trade licence, PT returns) | 4 | Not started | One approval for each state |

Three recipes use no portal pack: POSH / SHe-Box (mostly documents), ODI (filed through the bank) and ICDR (portal to confirm). 47 + 3 = 50.

## 5. The 50 form recipes

Size: S = one page, few fields. M = several pages. L = many pages, repeating groups or uploads.

### Incorporation agent (6)

| # | Form | Portal | Size | Status |
|---|---|---|---|---|
| 1 | SPICe+ Part A (name) | MCA | S | Beta, mock |
| 2 | SPICe+ Part B (incorporation) | MCA | L | Beta, mock |
| 3 | AGILE-PRO-S | MCA | M | Beta, mock |
| 4 | e-MoA (INC-33) | MCA | M | Beta, mock |
| 5 | e-AoA (INC-34) | MCA | M | Beta, mock |
| 6 | INC-9 and URC-1 attach | MCA | S | Later |

### Post-incorporation agent (2)

| # | Form | Portal | Size | Status |
|---|---|---|---|---|
| 7 | INC-20A (commencement) | MCA | S | Later |
| 8 | ADT-1 (first auditor) | MCA | S | Later |

### Registration agent (24, from checklist steps reg-1 to reg-24)

| # | Step | Registration | Portal | Size | Note |
|---|---|---|---|---|---|
| 9 | reg-1 | PF | EPFO | M | Often done through AGILE-PRO-S |
| 10 | reg-2 | PAN and TAN | Protean | S | Usually issued with SPICe+ |
| 11 | reg-3 | ESI | ESIC | M | Often done through AGILE-PRO-S |
| 12 | reg-4 | GST (REG-01) | GST | L | Suite data is ready. The pack is empty. DSC submit stays on the user's PC. |
| 13 | reg-5 | LUT (RFD-11) | GST | S | Yearly |
| 14 | reg-6 | LEI | LEI registrar | S | |
| 15 | reg-7 | Professional tax | State | M | One recipe for each state |
| 16 | reg-8 | IEC | DGFT | M | |
| 17 | reg-9 | Shops and establishments | State | M | One recipe for each state |
| 18 | reg-10 | Trade licence | State / municipal | M | One recipe for each city |
| 19 | reg-11 | STPI / non-STPI | STPI | M | |
| 20 | reg-12 | Trademark (TM-A) | IP India | M | |
| 21 | reg-13 | CLRA | Shram Suvidha | M | |
| 22 | reg-14 | POSH / SHe-Box | SHe-Box | S | Mostly documents, not a portal form |
| 23 | reg-15 | Udyam (MSME) | Udyam | S | Aadhaar OTP stays with the person |
| 24 | reg-16 | ICEGATE | ICEGATE | M | |
| 25 | reg-17 | Trademark renewal (TM-R) | IP India | S | |
| 26 | reg-18 | Patent | IP India | L | Usually a patent agent files it. Prepare only. |
| 27 | reg-19 | ICDR | To confirm | S | Confirm the portal with the team |
| 28 | reg-20 | FC-GPR | RBI FIRMS | L | |
| 29 | reg-21 | FDI reporting (entity master) | RBI FIRMS | M | |
| 30 | reg-22 | ODI reporting | Through the bank (AD) | M | Prepare the documents only |
| 31 | reg-23 | FLA return | RBI FLAIR | M | Yearly |
| 32 | reg-24 | FC-TRS | RBI FIRMS | M | |

### Compliance agent (18)

| # | Filing | Portal | How often | Size | Note |
|---|---|---|---|---|---|
| 33 | GSTR-1 | GST | Monthly / quarterly | M | A GSP API is the better route |
| 34 | GSTR-3B | GST | Monthly | M | Payment stays with the person |
| 35 | GSTR-9 | GST | Yearly | L | |
| 36 | GSTR-9C | GST | Yearly | L | |
| 37 | Challan 281 (TDS) | Income tax | Monthly | S | Agent prepares. Person pays. |
| 38 | 24Q / 26Q TDS return | Protean | Quarterly | M | File builder, not a web fill |
| 39 | Form 16 / 16A | TRACES | Yearly / quarterly | S | Download |
| 40 | Challan 280 (advance tax) | Income tax | Quarterly | S | Agent prepares. Person pays. |
| 41 | ITR-6 | Income tax | Yearly | L | E-verify stays with the person |
| 42 | Tax audit (3CA / 3CD) | Income tax | Yearly | L | The auditor signs |
| 43 | DIR-3 KYC | MCA | Yearly | S | |
| 44 | AOC-4 | MCA | Yearly | L | |
| 45 | MGT-7 / MGT-7A | MCA | Yearly | L | |
| 46 | DPT-3 | MCA | Yearly | M | |
| 47 | MSME-1 | MCA | Half-yearly | S | |
| 48 | PF ECR | EPFO | Monthly | M | Payment stays with the person |
| 49 | ESIC contribution | ESIC | Monthly | M | Payment stays with the person |
| 50 | PT return | State | Monthly / yearly | S | One recipe for each state |

## 6. Steps to build one recipe

All 50 recipes use the same five steps. A recipe goes live only after step 5.

```
 [1 RECORD]      [2 MOCK]        [3 RECIPE]      [4 TEST]        [5 LIVE PILOT]
 A staff member  Build a fake    Write the       Run on the      Supervised real
 files once with copy of the     fields and      mock in the     filings. The
 the recorder.   pages from the  steps. Map to   live browser.   reviewer signs
 No values are   recording.      Suite data.     0 AI calls.     off each one.
 kept.
     |               |               |               |               |
     +-- needs CS ---+-- no CS ------+-- no CS ------+-- no CS ------+-- needs CS
         approval        needed          needed          needed          approval
```

## 7. Build waves

| Wave | What | Agents | Recipes | Depends on |
|---|---|---|---|---|
| 0 | Platform: live browser, shared engine, orchestrator, the 6 helper agents | 1, 6 to 11 | 0 | Nothing (mock only) |
| 1 | Incorporation on the live browser | 2, 3 | 1 to 8 | Wave 0. CS opinion for live use. |
| 2 | High-volume registrations | 4 | 9 to 17, 23 (PF, PAN/TAN, ESI, GST, LUT, LEI, PT, IEC, S&E, Udyam) | Wave 0. CS question 30 for GST. |
| 3 | Monthly compliance | 5 | 33, 34, 37, 48, 49, 50 | Wave 2 packs (GST, EPFO, ESIC, State) |
| 4 | Annual compliance | 5 | 35, 36, 38 to 47 | Wave 3 |
| 5 | Other registrations | 4 | 18 to 22, 24 to 32 | New CS questions (RBI, IP India, ICEGATE, LEI, STPI) |

```
 Wave:   0 ======>
         1      ======>
         2         =========>
         3                 =======>
         4                        ==========>
         5                              ==========>
         -------------------------------------------------> time
         ^ CS letter sent here.  The CS reply unlocks live use in waves 1 to 5.
```

## 8. What the person always does

No agent and no setting can change this table. The guards in `SAFETY.md` enforce it.

| Action | Agent | Person |
|---|---|---|
| Type the login ID and password | Never | Yes |
| Type the captcha | Never | Yes |
| Type the OTP, Aadhaar OTP or EVC | Never | Yes |
| Fill the form fields | Yes | Checks the preview |
| Upload documents from the vault | Yes | Checks |
| Sign with DSC | Never | Yes, on their own PC |
| Press Submit | Never | Yes, after the certifier's checks |
| Pay the fee or the tax | Never | Yes, from their own bank |
| Read and save the ARN / SRN | Yes | Checks |

## 9. Open decisions for the owner

| # | Decision | Default in this plan |
|---|---|---|
| 1 | Use a GSP API for GST returns (GSTR-1, GSTR-3B) instead of the live browser | Ask the CS. Prefer GSP if the CS prefers it. |
| 2 | Which states to cover first for PT, S&E and the trade licence | Telangana and Andhra Pradesh |
| 3 | Is a patent prepared only, or also filed | Prepare only |
| 4 | Confirm the ICDR portal (reg-19) | To confirm with the team |
