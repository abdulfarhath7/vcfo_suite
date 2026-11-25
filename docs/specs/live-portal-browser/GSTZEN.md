# GSTZen APIs and the card agents

Written 25 Nov 2026 in ASD-STE100 style. Source: the GSTZen API docs at
https://my.gstzen.in/docs/api/ (read in a browser on 25 Nov 2026). Nothing in Suite uses GSTZen yet.

## 1. Verdict

GSTZen helps a lot for GST returns and GST data. It does not help with GST registration.

- Firm policy SBC-STD-AI-02 already allows this route: "Machine access, if ever wanted, goes only
  through a contracted GST Suvidha Provider with the taxpayer's API consent"
  (`docs/context/notes/checklist-workflow.md`). Confirm that GSTZen is a GSP, or an ASP through a
  GSP, and sign a contract with data terms.
- GST returns move from the live browser to the API. No screen, no recipe and no browser upkeep.
- GST REG-01 and the LUT (RFD-11) are not in the GSTZen API list. They stay on the live browser
  plan, or "prepare data only", until the CS answers.

## 2. What the APIs cover

| Group | APIs | Use in Suite |
|---|---|---|
| GSTN session | Generate OTP, Establish session, Refresh session, Check session | The taxpayer's consent. The OTP goes to the taxpayer's registered mobile. A session stays active 6 hours and can be refreshed for up to 30 days. |
| GSTR-1, GSTR-1A | Download, save, reset, proceed to file, file with EVC or DSC, return status | Monthly or quarterly sales return |
| GSTR-2A / 2B, purchase register, reconciliation | Fetch and reconcile purchase data | ITC check before GSTR-3B |
| GSTR-3B | Auto-calculated liability, interest, save, offset, file with EVC or DSC, cash and ITC balance | Monthly return |
| GSTR-9, GSTR-9C | Auto-calculated figures, save, status, proceed, file with EVC or DSC | Annual return and reconciliation |
| Ledgers | Cash, ITC, liability, credit reversal, negative liability, balances | Pre-filing checks, client dashboard |
| IMS | Invoice counts, lists, request status | Invoice management system actions |
| Notices | List, open, replied and closed, detail, documents | A new notice watcher: notices land in Suite |
| Validators | GSTIN validator (legal name, status, address, jurisdiction), HSN/SAC validator, vendor filing status | GST registration tracker after approval, HSN check in "Before I fill", vendor checks |
| E-invoice, e-way bill | Generate, cancel, details | Later, if SBC prepares these for clients |
| Account | JWT login (token valid 24 hours), Create GSTIN | Server-side only |

### GST work NOT in the GSTZen API list (25 Nov 2026)

"Not in the list" means the public docs show no API for it. Confirm each one with GSTZen.

| Area | GST work | Form | Route until GSTZen confirms |
|---|---|---|---|
| Registration | New registration | REG-01 | Live browser after the CS answer; prepare data only until then |
| Registration | Aadhaar authentication of promoters and signatory | (link sent by the portal) | Each person on their own phone; the tracker reminds them |
| Registration | Reply to a clarification notice | REG-03 / REG-04 | Live browser or manual |
| Registration | Registration certificate download | REG-06 | Manual upload to the tracker |
| Registration | Amendment of core or non-core fields | REG-14 | Live browser or manual |
| Registration | Cancellation and revocation | REG-16 / REG-21 | Live browser or manual |
| Registration | Add or change an authorised signatory; register a DSC on the portal | - | Manual |
| Registration | Switch on API access for the GSP | Portal profile setting | The client does it once, during onboarding |
| Export | Letter of undertaking | RFD-11 (LUT) | Live browser or manual |
| Composition | Opt in or opt out | CMP-02 / CMP-04 | Manual |
| Composition | Quarterly statement and annual return | CMP-08 / GSTR-4 | Manual or a future API |
| Other returns | Non-resident, ISD, TDS deductor, TCS (e-commerce), final return | GSTR-5 / 6 / 7 / 8 / 10 | Manual, by need |
| Other returns | Job work statement | ITC-04 | Manual |
| ITC forms | ITC declarations | ITC-01 / 02 / 03 | Manual |
| Payment | Create a challan and pay | PMT-06 | The person pays from their own bank (always) |
| Payment | Voluntary payment | DRC-03 | Manual |
| Refunds | Refund application | RFD-01 | Live browser or manual |
| Notices | Reply to a notice or show-cause notice (the Notice API only reads) | ASMT-11, DRC-06 and others | Draft the reply in Suite; the person uploads it |
| Appeals | Appeal | APL-01 | Manual, with the CA |
| IMS | Accept or reject invoices (the docs show counts, lists and status only) | IMS actions | Confirm with GSTZen |

Limit seen in the docs: the plan allows 25 GSTINs ("You have exceeded your current plan's limit
of 25 GSTINs"). Check SBC's plan against the number of clients.

## 3. How a GST return agent works with the API (no browser)

```
 [Start on the GSTR-3B card]
        v
 [Before I fill]  sales from Tally / Zoho, 2B from GSTZen, ledger balance
        v
 [YOUR TURN: consent OTP]   only if no active GSTN session for this GSTIN
   the OTP goes to the client's registered mobile; the client types it
   in the client portal, or tells the person on a call who types it
        v
 [Agent saves the return through the API]  (Inngest job)
        v
 [Show the portal's own summary: liability, ITC, interest, cash needed]
        v
 [Certifier ticks the checks]
        v
 [YOUR TURN: pay any cash due from your own bank]
        v
 [YOUR TURN: EVC OTP to the authorised signatory] --> agent files
        v
 [ARN saved on the card] --> [Filed]
```

The person still gives every OTP and pays. The agent never sees a portal password.

## 4. Changes to the agent plan

| Item | Before | With GSTZen |
|---|---|---|
| GSTR-1, GSTR-3B, GSTR-9, GSTR-9C | Live browser recipes, wait for the CS | API agent (`kind: 'api-file'` in `catalog.ts`). Policy already allows it once GSTZen is contracted. |
| New: GSTR-2B reconciliation | Not planned | API agent |
| New: GST notice watcher | Not planned | Inngest job pulls notices daily into the client record |
| GST registration tracker | Typed by hand | GSTIN validator fills legal name, status and jurisdiction after approval |
| "Before I fill" | Suite data only | Adds HSN/SAC validation and live ledger balances |
| GST REG-01, LUT | Live browser | No change (not in the API) |
| Live browser recipes | 50 | 46 (4 GST returns move to the API) |

## 5. How to build the GSTZen part

| Step | Work | Where |
|---|---|---|
| 1 | Contract and data terms with GSTZen. Confirm the GSP. Ask where data is hosted. | Owner |
| 2 | Store the GSTZen login in Secrets Manager. Server-side client only, never in the browser bundle. | `src/lib/gstzen/client.ts`, `infra/` |
| 3 | Repository for GSTN session status per GSTIN (status and expiry only, no tokens; GSTZen holds them). | `src/db/repositories/gstzen-sessions.ts`, one additive migration |
| 4 | Consent OTP step on the card; client portal "Your turn" for the client's own OTP. | Card agent panel |
| 5 | Save, status poll and file as Inngest jobs (slow calls stay out of the request). | `src/jobs/gst-return-*.ts` |
| 6 | Return cards for GSTR-1 and GSTR-3B first, then GSTR-9 and 9C. | Card agents |
| 7 | Notice watcher and GSTIN validator on the GST tracker. | `src/jobs/`, `GstRegistrationTracker.tsx` |

Test against GSTZen's sandbox if they have one; ask them. Never send test data to a live GSTIN.

## 6. Questions for GSTZen

1. Is GSTZen a GSP, or an ASP through which GSP? Licence number?
2. Where is our data hosted (region)? Is there a data processing agreement?
3. Is there a sandbox?
4. Do you support GST registration (REG-01), the LUT (RFD-11) or the application status (ARN tracking)?
5. What are the rate limits and the price per GSTIN above 25?
6. Does the taxpayer need to switch on API access in the GST portal profile first?
