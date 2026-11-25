# eMudhra integration: items we need, cost, use

| Field | Value |
|---|---|
| Written | 25 Nov 2026 |
| Base plan | `PLAN.md` (same folder) |
| Price basis | Retail or reseller price. Without 18% GST. Replace with SBC partner price after the meeting. |

## 1. Items we get from eMudhra

| # | Item | What we get | Free or paid | Cost (estimate) | Where we use it (use case #) |
|---|---|---|---|---|---|
| E1 | ASP agreement (eSign Application Service Provider) | Legal right to send eSign requests from our app | Paid (setup) | Quote. A one-time setup fee is possible. | All eSign use cases (#1, #2, #3, #6, #8, #9, #10) |
| E2 | UAT (test) account | Test client ID, test API key, test Aadhaar numbers | Free (usually) | ₹0 | Build and test before go-live |
| E3 | API documents | eSign gateway spec, emSigner REST spec, error codes | Free with E1 | ₹0 | `src/lib/esign/emudhra/client.ts` |
| E4 | Callback (webhook) spec and secret | Signed status events: sent, signed, declined, expired | Free with E1 | ₹0 | `app/api/webhooks/emudhra` |
| E5 | Production API key | Live access to eSign | Free with E1; you pay per use (E6) | ₹0 for the key | Live app (`app.sbctrack.in`) |
| E6 | eSign credits | One Aadhaar OTP signature on one document | Paid | About ₹5 per document | #1 board resolution, #2 director pack, #3 subscription sheet, #6 board meeting, #8 approvals, #9 engagement letter, #10 registrations |
| E7 | emSigner workflow licence | Multi-signer order, reminders, audit-trail PDF | Paid | Quote (not published) | #2, #3, #6 (documents with more than one signer) |
| E8 | DSC partner / RA account | Right to order DSCs for clients from our app | Paid or free: ask | Quote | #4 DSC order, #5 DSC renewal |
| E9 | Class 3 DSC, Indian person, 2 years, with token | Signature certificate for MCA, GST, EPFO, ICEGATE | Paid | ₹1,200 – 1,800 each | #4 (pre-7), #10, #13 MCA forms |
| E10 | Class 3 DSC, foreign person | The same, for a non-resident director | Paid | ₹7,500 – 11,500 each | #12 foreign director |
| E11 | DSC renewal | New validity on the same identity | Paid | ₹900 – 1,700 each | #5 (expiry alert) |
| E12 | USB token | Hardware that holds the DSC | Paid | Included in E9, or ₹400 – 800 | #4 |
| E13 | Cloud (remote) DSC | DSC kept in eMudhra HSM. Signer signs from any place. | Paid | Quote | #13 (only if MCA accepts it) |
| E14 | emBridge | Browser connects to the USB token | Free | ₹0 | #13 MCA form signing |
| E15 | eMudhra CA certificates and OCSP / CRL address | Public data to check a signature chain | Free | ₹0 | #7 signature check (`src/lib/mca-filing/pdf-signatures.ts`) |
| E16 | Signature check API | eMudhra checks a signed PDF for us | Free or paid: ask | Quote | #7 (other option to E15) |
| E17 | Identity check (PAN, name, date of birth) | Match result before a DSC order | Paid (if offered) | Quote | #11 KYC sheet, pre-15 |
| E18 | Foreign eSign | eSign for a person with no Aadhaar | Paid (if offered) | Quote | #12 |
| E19 | Organisation / bulk signer certificate | Firm signature on many PDFs from the server | Paid | Quote | #15 signed invoices |
| E20 | Support and SLA | Help desk, uptime promise, escalation contact | Free or paid: ask | Quote | Production support |
| E21 | IP allowlist entry | eMudhra accepts calls only from our IP address | Free | ₹0 | App Runner outbound IP (NAT) |

## 2. Items we supply (not from eMudhra)

| # | Item | What it does | Free or paid | Cost (estimate) | Where |
|---|---|---|---|---|---|
| S1 | AWS Secrets Manager secret `vcfo/emudhra-api-key` | Keeps the API key safe | Paid | About $0.40 (₹35) per month | `src/lib/secrets/app-secrets.ts` |
| S2 | Static outbound IP | Gives eMudhra one IP for E21 | Paid (exists) | ₹0 new: the NAT instance is in place | `infra/` (private network) |
| S3 | LibreOffice in the app image | Changes Word (docx) to PDF | Free | ₹0 (image gets larger) | `src/lib/esign/to-pdf.ts` |
| S4 | Callback URL | `https://app.sbctrack.in/api/webhooks/emudhra` | Free | ₹0 | E4 |
| S5 | S3 storage | Keeps unsigned PDF, signed PDF, audit trail | Paid (exists) | Less than ₹10 per month | `src/storage/s3.ts` |
| S6 | Inngest jobs | Prepare, send, poll, finish | Paid (exists) | ₹0 new | `src/jobs/esign-*.ts` |
| S7 | WhatsApp nudges | Tell the signer that a document waits | Paid (exists) | Less than ₹1 per message | `src/lib/notify/send-whatsapp.ts` |
| S8 | CS opinion | Says which eSigned documents MCA accepts | Internal | Internal time | #2, #3, #13 |
| S9 | Firm decision: who pays | SBC pays, or the client pays in the fee | Internal | — | Engagement fee |
| S10 | Development work | Build the signing module and pages | Internal | Internal time | Phases 1 to 4 |

## 3. Cost by type

| Cost type | Items | Amount (estimate) |
|---|---|---|
| One time | E1 setup, E8 partner setup, S10 build | Quote from eMudhra + internal time |
| Per company (one incorporation, 2 Indian directors, no DSC) | 2 × E9, 23 × E6, S7 | About ₹2,500 – 3,700 (+GST about ₹2,950 – 4,400) |
| Per company, directors have a valid DSC | 23 × E6, S7 | About ₹125 |
| Each foreign director | E10 in place of E9 | + ₹6,300 – 9,700 |
| Every 2 years, each director | E11 | ₹900 – 1,700 |
| Each month | S1, S5, E7 (if a platform fee) | About ₹45 + E7 quote |
| Free | E2, E3, E4, E5 key, E14, E15, E21, S3, S4 | ₹0 |

## 4. Status today

| Status | Items |
|---|---|
| We can get or use now, with no meeting | E14, E15, S1 to S7 |
| We get after the meeting and the agreement | E1 to E8, E20, E21 |
| Unknown: ask eMudhra | E13, E16, E17, E18, E19 |
| Blocked by a rule | Aadhaar eSign on MCA forms (MCA does not accept it). E13 on MCA (not confirmed). |

## 5. Where each item goes in the app

```
 eMudhra items                         VCFO Suite location
 ─────────────                         ───────────────────
 E1 agreement ─┐
 E3 API docs ──┼────────────────────► src/lib/esign/emudhra/client.ts
 E2/E5 keys ───┘                       (key stored in S1)
 E4 webhook ─────────────────────────► app/api/webhooks/emudhra  (S4)
 E6 eSign credits ─┬─────────────────► pre-3  board resolution        (#1)
                   ├─────────────────► pre-8  director pack           (#2)
                   ├─────────────────► pre-16 subscription sheet      (#3)
                   ├─────────────────► board meetings                 (#6)
                   ├─────────────────► pre-9  client approvals        (#8)
                   ├─────────────────► engagement letter              (#9)
                   └─────────────────► registrations                  (#10)
 E7 emSigner ────────────────────────► multi-signer: #2, #3, #6
 E8 partner + E9/E10 DSC ────────────► pre-7 "Order DSC"              (#4)
 E11 renewal ────────────────────────► compliance calendar alert      (#5)
 E14 emBridge + E9 DSC ──────────────► MCA forms (signer's own PC)    (#13)
 E15/E16 CA data ────────────────────► src/lib/mca-filing/pdf-signatures.ts (#7)
 E17 identity check ─────────────────► KYC sheet, pre-15              (#11)
 E18 foreign eSign / E10 ────────────► non-resident director pack     (#12)
 E19 org certificate ────────────────► receivables invoices           (#15)
```

## 6. Steps to get the items

```
 [1] Meeting with eMudhra tech team
        │  ask MEETING-QUESTIONS.md
        ▼
 [2] Sign E1 ASP agreement + E8 partner account
        │
        ▼
 [3] Get E2 UAT keys, E3 docs, E4 webhook spec ──► build Phase 1 (S1–S6, S10)
        │
        ▼
 [4] Test in UAT with test Aadhaar numbers
        │
        ▼
 [5] Send our IP for E21 ──► get E5 live key
        │
        ▼
 [6] Buy E6 credits (prepaid) ──► go live with #1 and #6
        │
        ▼
 [7] Order E9 DSCs from pre-7 ──► #4, then #5 renewals
```

## 7. Questions that change the cost

| # | Question | Changes which item |
|---|---|---|
| Q1 | Is there a one-time setup fee for the ASP agreement? | E1 |
| Q2 | What is the partner price per eSign? Is there a volume slab? | E6 |
| Q3 | Is a document with 3 signers 1 charge or 3 charges? | E6 |
| Q4 | Is emSigner a monthly fee or a per-document fee? | E7 |
| Q5 | What is the partner price per DSC? Is a token included? | E9, E12 |
| Q6 | Do you offer cloud DSC, foreign eSign, identity check? Price? | E13, E17, E18 |
| Q7 | Is the support desk included? | E20 |
