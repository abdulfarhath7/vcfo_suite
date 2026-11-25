# eMudhra in VCFO Suite: where it fits, how we integrate, what it costs

Status: plan only, written 25 Nov 2026. No code is built. Phase 1 starts after the meeting with the eMudhra tech team (questions in `MEETING-QUESTIONS.md`). The full list of items to get from eMudhra, with cost and use, is in `REQUIREMENTS.md`. Prices below are public retail figures or market ranges and must be confirmed with eMudhra.

## Context

SBC has a working relationship with eMudhra and wants to use eMudhra's APIs inside VCFO Suite.
eMudhra is a licensed Indian Certifying Authority. It sells four things that matter to us:

| eMudhra product | What it does | API? |
|---|---|---|
| **Aadhaar eSign (ESP)** | One-time signature: signer enters Aadhaar, gets an OTP, eMudhra issues a short-lived certificate and signs the PDF. CCA eSign API v2.1. | Yes (eSign gateway API) |
| **emSigner** | Signing workflow platform: multiple signers, order, reminders, audit trail. Uses Aadhaar eSign, DSC token or remote DSC. | Yes ("two API calls": create workflow, get status/document) |
| **DSC issuance (Class 3)** | Issues the Digital Signature Certificate on a USB token or cloud/HSM. Includes video verification and paperless (Aadhaar/PAN) KYC. | Partner / RA portal API (to be confirmed) |
| **emBridge / remote signing** | Local utility that lets a browser use a DSC token; remote (HSM) DSC lets a person sign with their own DSC from anywhere. | SDK / remote signing API |

What the codebase scan found (Explore agent, 25 Nov 2026):

- eMudhra is already in the workflow as a **manual** step: checklist step `pre-7 KYC Review & DSC` ("initiates DSC with eMudhra"), with DSC success-message upload, DSC expiry and video-verification slots per director (`src/data/checklist.ts:324`, `src/lib/checklist/checklist-responses.ts:528-575, 1111-1124`).
- The app **reads** signatures but never **makes** them: `src/lib/mca-filing/pdf-signatures.ts` (CMS/ByteRange check; CCA trust chain not checked yet), `signers.ts`, `readiness.ts`.
- Every signing flow today is "download → sign outside → upload signed copy": board resolution (`app/api/engagements/[id]/board-resolution/upload-signed`), board-meeting documents (`board_meeting_documents` + `board_meeting_signature_events`), MCA filing signers (`assist_filing_signers`), labour registers (wet ink by firm decision).
- The client home already has a `'sign'` action (`src/lib/client/client-home.ts:13`, `pages/home/CardsA.tsx:304`) whose target, "the signing flow (DSC / e-sign)", **was never built**.
- DSC expiry tracking exists (`expiry_items` kind `dsc`, `src/jobs/expiry-alerts.ts`).
- No PAN/Aadhaar/DIN verification API exists (`src/lib/checklist/din-verification.ts` says "a paid lookup API can later fill the same keys").
- **No docx → PDF conversion exists.** eSign signs PDFs, and all our generated documents are docx. This is a required new piece.
- Firm policy: "software never signs; the Suite only reads signatures" (STATE.md). Aadhaar eSign fits this policy because the signer signs with their own OTP. MCA forms are a different matter (see "Legal limits").

---

## 1. Is it free?

**No. eMudhra is a paid service.** Retail numbers we could find, plus market ranges to confirm with eMudhra:

| Item | Public / market price | Notes |
|---|---|---|
| Aadhaar eSign, pay-per-use | **About ₹5 per signed document** (eMudhra eSign page) | Volume pricing on request. As a partner, SBC should ask for a lower slab. |
| Aadhaar eSign, individual plan | ₹999 per year, unlimited (eMudhra consumer page) | Consumer plan. Does not apply to API use. |
| emSigner (workflow platform) | No official API price published. Third-party listings range from a free 10-docs/month tier to about $12 per user per month. | Ask for a per-transaction API quote. |
| Class 3 DSC (individual) | Market range about ₹1,000 to ₹3,000 for 1 to 3 years, plus a USB token (about ₹400 to ₹800) | Partner / RA pricing for SBC is likely lower. Confirm. |
| Sandbox / UAT | Usually free for development, on request | Ask for UAT credentials in the meeting. |

So we pay per signature (eSign) and per certificate (DSC). The cost can be absorbed or passed to the client as a line in the engagement fee.

### Cost for one incorporation, step by step

Assumptions: one private company; two Indian resident directors who are also the two subscribers;
one parent-entity signatory; neither director has a valid DSC; a Class 3 sign-only DSC for two
years with a USB token; eSign at eMudhra's list price of ₹5 per signed document. Prices exclude
18% GST. They are retail or reseller figures, to be replaced with SBC's partner rates.

| Step (use case #) | What is bought | Unit price | Qty | Cost once |
|---|---|---|---|---|
| DSC for directors (#4, pre-7) | Class 3 DSC, 2 years, with token | ₹1,200 – 1,800 | 2 | ₹2,400 – 3,600 |
| Board resolution / NOC (#1, pre-3) | Aadhaar eSign | ₹5 | 1 | ₹5 |
| Director pack (#2): DIR-2, DIR-8, INC-9, ID and address declaration, deposit declaration | Aadhaar eSign | ₹5 | 5 × 2 = 10 | ₹50 |
| Subscription sheet / INC-33, INC-34 (#3) | eSign: 2 subscribers and 1 witness | ₹5 | 3 | ₹15 |
| Client approvals and SPICe+ confirmation (#8, pre-9) | eSign | ₹5 | 2 | ₹10 |
| Engagement letter (#9) | eSign | ₹5 | 1 | ₹5 |
| First board meeting (#6, post-1): notice, circular resolution (2 directors), minutes | eSign | ₹5 | 4 | ₹20 |
| Registrations (#10): power of attorney, LUT witness | eSign (DSC reused from #4) | ₹5 | 2 | ₹10 |
| MCA form signing (#13) | emBridge is free; it uses the DSC from #4 | ₹0 | — | ₹0 |
| Signature verification (#7) | Our own code with the public CCA roots | ₹0 | — | ₹0 |
| Docx to PDF, email | LibreOffice in our image; SES or Resend | ₹0 | — | ₹0 |
| WhatsApp nudges | Meta utility template through AWS | under ₹1 per message | about 10 | under ₹10 |
| **Total for one company** | | | 23 eSigns and 2 DSCs | **about ₹2,500 – 3,700** (with GST about ₹2,950 – 4,400) |

Cases that cost more, or only later:

| Case | Price | When |
|---|---|---|
| Foreign national director DSC (#12) | ₹7,500 – 11,500 each (reseller listings) | Per foreign director, instead of the ₹1,200 – 1,800 DSC |
| Director already holds a valid DSC | ₹0 for #4 | Common for repeat directors |
| DSC renewal (#5) | about ₹900 – 1,700 (no new token) | After two years |
| emSigner platform fee | Not published; quote needed | Only if we use emSigner workflows rather than the bare eSign API |
| Identity checks (#11) | Not published; quote needed | Only if eMudhra offers it |
| Signed invoices (#15) | Organisation or bulk signer certificate; quote needed | Not part of one incorporation |

The two DSCs are about 97% of the cost; all 23 eSigns together cost about ₹115. Ask eMudhra whether
a document with several signers is billed per document or per signature (it changes rows #3 and #6
only slightly).

---

## 2. Use cases: where eMudhra fits in VCFO Suite

Priority: **P1** = clear value, no legal question, build first. **P2** = good value, needs one decision. **P3** = needs a CS/MCA opinion or a firm-policy change.

| # | Where in the app | Today (manual) | With eMudhra | Product | Who signs | Priority |
|---|---|---|---|---|---|---|
| 1 | **Board resolution / NOC** for the parent entity (pre-2, pre-3; `BoardPage.tsx`, `StepBoardResolution.tsx`) | Client downloads, signs on letterhead, uploads | "Sign now" button: client eSigns the generated PDF in the portal; signed copy lands in S3 and the step advances | eSign / emSigner | Parent's signatory (pre-1) | **P1** (foreign parent signatories may lack Aadhaar: see row 12) |
| 2 | **Director consent pack**: DIR-2, DIR-8, INC-9, deposit and ID declarations (pre-8, pre-15) | Print, sign, scan, upload per director | One emSigner workflow per director with all their documents in one OTP session | emSigner (eSign or DSC) | Each director | **P2** (CS to confirm MCA accepts eSigned attachments, question E5) |
| 3 | **Subscription sheet / INC-33/34 witness** (pre-16) | Wet signature, witness | Multi-signer workflow: subscribers, then witness (CS/CA) | emSigner | Subscribers + witness | **P3** (e-MOA/e-AOA are DSC-signed on MCA; witness rules) |
| 4 | **DSC procurement for directors** (pre-7, pre-15) | Intern raises request on eMudhra portal, chases video slot, uploads success message | Suite creates the DSC application via API, sends the director the KYC/video link, polls status, stores certificate serial + expiry automatically, fills `expiry_items` | DSC issuance / partner API | Director (video KYC) | **P1** (biggest time saver for interns) |
| 5 | **DSC renewal** (compliance calendar, `expiry-alerts.ts`, `filingsAfterDscExpiry`) | Alert only | Alert carries a "Renew with eMudhra" action that opens a pre-filled renewal | DSC issuance | Director | **P1** (falls out of #4) |
| 6 | **Board meeting documents**: notice, circular resolution, minutes (`board_meeting_documents`, `/meeting-reply` HMAC links) | Send → signed copy back → lock | Directors sign from the same HMAC link; webhook marks `signed`; minutes locked | emSigner (multi-signer) | Directors / chairperson | **P1** (spec already says "e-sign is a later phase") |
| 7 | **Signature verification** (`pdf-signatures.ts`, `TRUST_CHAIN_CHECKED = false`) | Signature parsed, chain unchecked | Validate certificate chain to the CCA root and revocation (OCSP/CRL), or call eMudhra's verification service | emSigner verify / CCA roots | — | **P1** (makes the MCA filing record trustworthy) |
| 8 | **Client step approvals** (`app/api/client/steps/[stepId]/approve`) and SPICe+ confirmation (pre-9) | Click to approve | Optional eSign on the approval summary PDF for a legally stronger record | eSign | Client | **P2** |
| 9 | **Engagement letter / proposal** (growth pipeline "proposal" stage; nothing exists today) | Email + PDF | New: generate engagement letter, client eSigns, engagement opens | eSign | Client | **P2** (new feature; small) |
| 10 | **Registrations**: PF/EPFO (reg-1), ICEGATE (reg-16), LUT witnesses (reg-5), IP power of attorney (reg-12/18) | Signatory DSC tracked by hand | Reuse #4 for DSC; eSign the POA and LUT witness pages where the department accepts it | DSC + eSign | Signatory | **P2** |
| 11 | **Identity checks**: PAN, Aadhaar (masked), DIN data (`din-verification.ts`, KYC sheet) | Typed by hand, verified by eye | Verify PAN/name/DOB match before DSC application (eMudhra KYC used inside DSC issuance) | eMudhra KYC (if offered) | — | **P2** (ask what eMudhra exposes) |
| 12 | **Foreign directors / signatories** (non-resident director pack, apostille) | Apostilled wet signatures | eMudhra foreign eSign / foreign DSC (emSigner lists "foreign eSign") | emSigner foreign eSign | Foreign director | **P3** (MCA acceptance) |
| 13 | **MCA form signing** (SPICe+, AGILE-PRO-S, AOC-4, MGT-7, DIR-3 KYC) | Each signer affixes DSC in Adobe/emBridge | Option S2 from `mca-connect/PLAN.md`: signer signs the exact MCA PDF with their own token via emBridge, or their own remote DSC | emBridge / remote DSC | Director, professional | **P3** (Aadhaar eSign is **not** accepted by MCA; remote DSC unconfirmed: E5) |
| 14 | **Labour register attestation** (`AttestDialog.tsx`) | Wet signature by firm decision (Nov 2026) | Leave as is. Schema already allows `aadhaar-esign` if the firm reverses the decision | — | — | **Not now** |
| 15 | **Invoices / receivables** | Unsigned PDFs | Optional digitally signed invoices (GST allows DSC-signed invoices) using a firm DSC on a server-side signer | eMudhra document signer (org DSC) | SBC (organisation) | **P3** (nice to have) |

### Where it lands in the app (map)

```
                        VCFO SUITE
 ┌──────────────────────────────────────────────────────────────────────┐
 │  INCORPORATION (34-step SPICe+ checklist)                            │
 │                                                                      │
 │  pre-1 Client ─► pre-2/3 Board Res. ─► pre-4 Name ─► pre-15 Directors │
 │                  [eSign #1] ◄──┐                     [DSC buy #4]    │
 │                                │                          │          │
 │  pre-16 Subscribers ─► pre-7 KYC & DSC ─► pre-8 Execution ─► pre-9 ─► pre-10 SPICe+
 │  [workflow #3]         [DSC API #4]      [director pack #2] [#8]   [emBridge #13, P3]
 │                                                                      │
 │  post-1 First board meeting ─► post-2 ADT-1 ─► reg-1 PF / reg-16 ICEGATE
 │  [board docs #6]                               [DSC reuse #10]       │
 ├──────────────────────────────────────────────────────────────────────┤
 │  COMPLIANCE CALENDAR      expiry_items(dsc) ─► alert ─► [Renew #5]    │
 │                           AOC-4 / MGT-7 / DIR-3 KYC need a valid DSC  │
 ├──────────────────────────────────────────────────────────────────────┤
 │  BOARD MEETINGS           notice · circular res. · minutes [#6]       │
 ├──────────────────────────────────────────────────────────────────────┤
 │  MCA FILING RECORD        pdf-signatures.ts ─► [chain check #7]       │
 ├──────────────────────────────────────────────────────────────────────┤
 │  CLIENT PORTAL            Home "Sign" action ─► one Sign page [#1,#2,#8,#9]
 ├──────────────────────────────────────────────────────────────────────┤
 │  GROWTH / ENGAGEMENTS     proposal ─► engagement letter [#9]          │
 └──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Integration architecture

One provider-neutral **signing module** with eMudhra as its first provider. Every feature
(board resolution, board meetings, director pack, engagement letter) creates a *signing request*
through the same repository; none of them calls eMudhra directly. This follows the seam rule
and "one page per feature".

```
  Browser (staff or client portal)                 Director / signer (no account)
        │  "Send for signature" / "Sign now"              │  HMAC link (reuse reply-token.ts)
        ▼                                                  ▼
 ┌─────────────────────── Next.js on App Runner ─────────────────────────────┐
 │ app/api/esign/requests            (create)                                │
 │ app/api/esign/requests/[id]       (status, cancel, download)              │
 │ app/api/esign/return              (browser redirect after OTP)            │
 │ app/api/webhooks/emudhra          (status callback, signature-verified)   │
 │            │                                                              │
 │            ▼                                                              │
 │ src/db/repositories/esign/  ◄── AuthContext, role scoping (the seam)      │
 │            │                                                              │
 │            ▼                                                              │
 │ src/lib/esign/                                                            │
 │   provider.ts        interface SignProvider { create, status, fetch,      │
 │                                               verifyWebhook }             │
 │   emudhra/client.ts  REST client (eSign gateway + emSigner)               │
 │   emudhra/dsc.ts     DSC application + status (partner API)               │
 │   to-pdf.ts          docx → PDF (LibreOffice in the image, or eMudhra)    │
 │   verify.ts          extends lib/mca-filing/pdf-signatures.ts (CCA chain) │
 └────────────┬──────────────────────────────┬──────────────────────────────┘
              │ Inngest events                │ S3 (src/storage/s3.ts)
              ▼                                ▼
 ┌──────────────────────────┐      ┌──────────────────────────────┐
 │ src/jobs/esign-*.ts      │      │ unsigned.pdf · signed.pdf     │
 │  - prepare (docx→PDF,    │      │ audit-trail.pdf (from eMudhra)│
 │    hash, upload)         │      └──────────────────────────────┘
 │  - send (create workflow)│
 │  - poll fallback (cron)  │      Secrets Manager: vcfo/emudhra-api-key
 │  - on-signed (verify,    │      Env: EMUDHRA_ENABLED, EMUDHRA_BASE_URL,
 │    store, advance step,  │           EMUDHRA_CLIENT_ID, EMUDHRA_MODE=uat|prod
 │    email + WhatsApp)     │
 │  - dsc-status (poll)     │
 └───────────┬──────────────┘
             │ HTTPS (API key / mTLS, as eMudhra requires)
             ▼
 ┌─────────────────────────── eMudhra ───────────────────────────┐
 │ eSign ESP (Aadhaar OTP) · emSigner workflows · DSC issuance    │
 │ (video KYC) · emBridge / remote DSC · signature verification   │
 └─────────────────────────────────────────────────────────────────┘
```

### Sequence: board resolution eSign (use case #1)

```
Lead            Suite API          Inngest job          eMudhra            Client signatory
 │ Finalize BR     │                    │                   │                     │
 │────────────────►│ create request     │                   │                     │
 │                 │──event────────────►│ docx→PDF, hash,   │                     │
 │                 │                    │ put S3            │                     │
 │                 │                    │──create workflow─►│                     │
 │                 │                    │◄─ workflowId, URL─│                     │
 │                 │                    │ email + WhatsApp link ─────────────────►│
 │                 │                    │                   │◄── opens, Aadhaar,  │
 │                 │                    │                   │    OTP, signs       │
 │                 │◄──────── webhook: SIGNED (HMAC-verified)│                     │
 │                 │──event────────────►│ fetch signed PDF + audit trail          │
 │                 │                    │ verify signature (verify.ts)            │
 │                 │                    │ store S3, mark BR signed, advance pre-3 │
 │◄── notification │                    │ audit_events + engagement_step_events   │
```

### Sequence: DSC issuance (use cases #4 and #5)

```
Intern (pre-7) ─► Suite: "Order DSC" for director D (data from pre-15 + KYC sheet)
Suite ─► eMudhra DSC API: create application (class 3, validity, token or cloud)
eMudhra ─► Director: KYC link + video verification (slots from pre-15)
eMudhra ─► Suite webhook / poll: APPROVED, serial, valid-to
Suite: fill pre-7 answers (proof, expiry), upsert expiry_items(kind=dsc),
       update assist_filing_signers.hasDsc / dscExpiry, notify intern
Later: expiry-alerts.ts ─► "Renew" ─► same API with renewal flag
```

### Data model (one new migration, additive)

- `esign_requests`: id, engagementId, sourceKind (`board_resolution`, `board_meeting_doc`, `director_pack`, `engagement_letter`, `step_approval`), sourceId, provider (`emudhra`), providerRef, status (`draft`, `prepared`, `sent`, `partially_signed`, `signed`, `declined`, `expired`, `failed`), unsignedKey, signedKey, auditTrailKey, unsignedSha256, createdBy, timestamps.
- `esign_signers`: requestId, order, name, email, mobile, role (director, subscriber, signatory, witness), method (`aadhaar_esign`, `dsc_token`, `remote_dsc`), status, signedAt, certSerial, certIssuer.
- `esign_events`: requestId, type, payload (redacted), at. (Same shape as `board_meeting_signature_events`.)
- `dsc_orders`: engagementId, directorRef, providerRef, status, certSerial, validTo, tokenType.
- **Never stored:** Aadhaar number, OTP, DSC PIN. eMudhra holds the eKYC; we keep only the masked name and the certificate details from the signed PDF.

### Existing code to reuse (no new copies)

| Need | Reuse |
|---|---|
| API client, token sealing | `src/lib/integrations/zoho/` layout, `src/lib/integrations/token-crypto.ts` |
| Secrets | `src/lib/secrets/runtime-secret.ts`, `app-secrets.ts` (add `emudhraApiKey`) |
| Webhook with signature check | `app/api/webhooks/aws-eum/route.ts`, `src/lib/notify/aws-sns-verify.ts` pattern |
| Jobs | `src/jobs/client.ts`, `integrations-zoho.ts` (event job), `gst-registration-start.ts` (cron, `withRunNow`, `skipWhenPaused`) |
| Tokenised links for people without accounts | `src/lib/board-meetings/reply-token.ts` |
| Files | `src/storage/s3.ts` (`putObject`, `signedDownloadUrl`, `bucketKey`) |
| Signature reading | `src/lib/mca-filing/pdf-signatures.ts`, `signers.ts`, `readiness.ts` |
| Audit, email, WhatsApp | `recordAuditEvent`, `sendEmail`, `send-whatsapp.ts` (WhatsApp stays additive) |
| Expiries | `expiry_items`, `src/jobs/expiry-alerts.ts` |
| Client action | existing `'sign'` NeedKind on the client home; build the one Sign page it points to |
| Local token bridge (only if #13 goes ahead) | Tally connector pairing shape, `app/api/tally/connector/*` |

---

## 4. Legal limits to respect

- **MCA forms (SPICe+, AGILE-PRO-S, AOC-4, MGT-7, DIR-3 KYC) need a Class 3 DSC.** Aadhaar eSign is not accepted (`docs/specs/mca-connect/PLAN.md:70`). Remote/HSM DSC acceptance is open question **E5**.
- **DSC custody (B4, E2):** staff must not operate a director's token or PIN. Each signer signs personally. Our design keeps that: the signer always types their own OTP/PIN on eMudhra's page.
- **Attachments eSigned for MCA (DIR-2, INC-9, board resolution):** generally accepted as electronically signed documents under the IT Act, but get the CS opinion before switching off wet-ink.
- **Labour registers:** wet signature by firm decision; out of scope.
- **Firm policy SBC-STD-AI-02** ("software never signs"): satisfied, because the person signs and the software only routes the document.

---

## 5. Phased plan

| Phase | Scope | Depends on |
|---|---|---|
| **0. Meeting with eMudhra tech team** | Get UAT credentials, API docs, webhook spec, partner pricing. Questions below. | Owner sets up meeting |
| **1. Signing foundation** | `src/lib/esign/` provider interface + eMudhra client (UAT), docx→PDF, migration (`esign_*`), repository with AuthContext, routes, webhook, Inngest jobs, one client Sign page, tests with a mocked provider | Phase 0 |
| **2. First features** | #1 board resolution eSign, #6 board-meeting documents, #7 CCA chain verification | Phase 1 |
| **3. DSC lifecycle** | #4 DSC ordering from pre-7, #5 renewal from expiry alerts, `dsc_orders` | eMudhra partner/DSC API access |
| **4. Wider use** | #2 director pack, #8 approvals, #9 engagement letter, #10 registrations, #11 identity checks | CS opinion on E5 for #2 |
| **5. Later / needs opinion** | #3, #12, #13, #15 | CS + MCA confirmation |

Feature flag `EMUDHRA_ENABLED`; when off, every flow keeps today's upload path, so nothing breaks.

### Questions for the eMudhra tech meeting

1. Which API do we get: eSign gateway (ESP) directly, emSigner workflow API, or both? REST spec, auth (API key, OAuth, mTLS, IP allowlist)?
2. UAT/sandbox credentials and test Aadhaar numbers.
3. Webhooks: events, payload, signature scheme, retries. Or must we poll?
4. Input format: PDF only, or will they accept docx? Max size, multiple documents per OTP session, signature placement (coordinates or anchor text)?
5. Do they return an audit-trail PDF and the signer's certificate details?
6. DSC issuance API for partners: create application, push KYC data, video-KYC link, status, renewal, cloud vs token. Can SBC act as RA?
7. Does a PDF signed in emSigner pass MCA V3 upload validation? Is the PDF byte-preserved? (from `mca-connect` research)
8. Remote/HSM DSC: is it accepted on MCA V3 today?
9. Foreign nationals: foreign eSign and foreign DSC flow.
10. Partner pricing: per eSign slab, per DSC, emSigner platform fee, sandbox cost, billing model (prepaid credits?).
11. Data residency and retention: where are documents stored, for how long, can we request deletion?
12. Signature verification API, or do they supply the CCA root and OCSP endpoints?

---

## Verification (when Phase 1 is built)

- `npm run check` (typecheck, lint, test); unit tests for the provider with a mocked eMudhra client and webhook-signature tests; cross-tenant tests on the `esign` repository; an end-to-end run in eMudhra UAT on a demo engagement (board resolution: send → OTP sign → webhook → signed PDF in S3 → step advanced → signature verified by `pdf-signatures.ts`); `npm run e2e:smoke` for the new Sign page.

## Sources

- eMudhra eSign pricing (₹5 per document): https://esign.sandbox.emudhra.com/application
- eMudhra eSign individual / organisation plans: https://esign.sandbox.emudhra.com/individual , https://esign.sandbox.emudhra.com/organization
- emSigner product page: https://emudhra.com/en-in/emsigner/header-global
- CCA eSign API v2.1: https://www.cca.gov.in/sites/files/pdf/ACT/eSign-APIv2.1.pdf
- DSC price ranges (2026): https://www.indiafilings.com/emudhra/pricing , https://www.taxaj.com/learn/digital-signature-certificate-cost-india/
- Foreign national DSC: https://certificate.digital/foreign-dsc
- Third-party emSigner listings: https://www.softwaresuggest.com/emsigner , https://www.sourceforge.net/software/product/emSigner
