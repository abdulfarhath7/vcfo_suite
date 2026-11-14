# v6 — Round 2: decide

```
 STAMP
   Branch    claude/nice-babbage-ny1h0f
   Commit    9c09b7c (= main a4b9495 + v6-round1.md)
   Analyzed  2026-11-14
   Mode      analysis only · no code changed
   Legend    [F] fact, read in code/docs   [W] web source, not primary   [A] assumption
   Not legal advice. A CA / lawyer confirms every row marked VERIFY.
```

---

## Correction to Round 0 / Round 1

```
 [!] E2 is SMALLER than stated.
     docs/context/notes/checklist-workflow.md:237 [F]:
     "Machine access, if ever wanted, goes only through a contracted
      GST Suvidha Provider with the taxpayer's API consent."
     → SBC-STD-AI-02 ALREADY ALLOWS the GSTZen API route.
       It bans the browser route on GST. No policy change needed for GSP.
```

---

## Q1 · E1-E5 advice

### E1 · Multi-tenant model

```
+-----------------+---------------------+---------------------+---------------------+
|                 | a) tenant_id in     | b) Postgres RLS     | c) 1 deploy per     |
|                 |    repositories     |                     |    tenant (silo)    |
+-----------------+---------------------+---------------------+---------------------+
| Fits rule 2     | YES                 | NO (rule 2: not RLS)| YES (no change)     |
| Schema work     | tenant_id on ~164   | a) + policies on    | none                |
|                 | tables [F]          | every table         |                     |
| Repo work       | every query + every | session var per txn | none                |
|                 | AuthContext         | with pooled conns   |                     |
| Leak risk       | MED (one missed     | LOW                 | ~0 (separate DB,    |
|                 | filter = leak)      |                     | bucket, KMS key)    |
| Per-tenant KMS  | extra work          | extra work          | native              |
| Infra $/tenant  | low                 | low                 | HIGH (App Runner +  |
|                 |                     |                     | RDS each) [A]       |
| Upgrades        | 1                   | 1                   | N (Terraform        |
|                 |                     |                     | workspace loop)     |
| White-label     | 185 "SBC" strings in src/lib + src/views [F] — needed in ALL options |
| Dev effort      | 6-10 wks [A]        | 8-12 wks [A]        | 1-2 wks [A]         |
| Reversible      | hard                | hard                | EASY (merge later   |
|                 |                     |                     | to a))              |
+-----------------+---------------------+---------------------+---------------------+
 PICK  c) now, for tenants 2-10.  a) later, only when infra cost hurts.
 WHY   0 code change to the seam. Strongest isolation story for a CA buyer.
       Per-tenant KMS + region come free. You can move to a) later; you
       cannot easily undo a).
 FIRST TASK  remove "SBC" hardcoding → firm_settings (needed anyway).
```

### E2 · GST route

```
+-----------------+-----------------------------+-----------------------------+
|                 | a) Manual only              | b) GSP API (GSTZen) +       |
|                 |                             |    manual for the rest      |
+-----------------+-----------------------------+-----------------------------+
| Policy          | Allowed                     | ALLOWED already [F] (above) |
| GSTN stance     | -                           | Only sanctioned machine     |
|                 |                             | route (GSP → ASP) [F brief] |
| s.70 protected  | not touched                 | via GSTN's own interface    |
| system (2020)   |                             |                             |
| Needs           | nothing                     | GSP contract · per-client   |
|                 |                             | OTP API consent · DPA       |
| Covers          | -                           | Returns, ledgers, 2A/2B     |
|                 |                             | [A]. New REG-01 by API: NOT |
|                 |                             | confirmed [A] → Q3          |
| Browser ext. on | -                           | STAYS BANNED (brief row 4-5)|
| gst.gov.in      |                             |                             |
| Cost            | 0                           | GSP fees per GSTIN/call [A] |
| Reversible      | -                           | YES (stop contract)         |
+-----------------+-----------------------------+-----------------------------+
 PICK  b) for returns; REG-01 + LUT stay manual (tracker + data sheet +
       copy button + deep link = brief rows 1-3 "Allowed").
 WHY   Policy already permits it. It is GSTN's sanctioned channel.
```

### E3 · Portal credentials vault (`engagement_credentials`)

```
+-----------------+-----------------------------+-----------------------------+
|                 | a) Remove secret columns    | b) Keep vault               |
+-----------------+-----------------------------+-----------------------------+
| Guard G8        | MATCH                       | BREAKS G8 [F]               |
| GST brief row 7 | MATCH                       | "Prohibited for automation, |
|                 |                             | practice risk by hand"      |
| ICAI            | MATCH ("no lien over client | risk                        |
|                 | credentials", SAFETY G8)    |                             |
| Breach blast    | small                       | LARGE (all client logins)   |
| Client value    | lose "keep my passwords"    | keep                        |
| Keep            | IDs, reg. numbers, addresses, KYC labels (non-secret cols)|
| Prod data       | key secret is optional in infra/soc-runtime.tf:103 [F];  |
|                 | CLAUDE.md says unset → maybe 0 secrets in prod [A]        |
| Effort          | 2-4 days + migration        | 0                           |
| Reversible      | NO after purge → export to  | -                           |
|                 | client first                |                             |
+-----------------+-----------------------------+-----------------------------+
 PICK  a). Client keeps passwords in their own manager.
       Keep the workbook for non-secret rows. Drop credential_otps relay.
```

### E4 · AI live fill ("AI mode", v5 §6)

```
+-----------------+-----------------------------+-----------------------------+
|                 | a) Drop. Keep T0-T4         | b) Add AI mode + injector   |
+-----------------+-----------------------------+-----------------------------+
| Guards          | G9, G10, G13 MATCH          | breaks G9, G10, G13         |
| CS question 16  | as asked                    | must re-ask                 |
| Prompt inject.  | AI returns index only       | AI returns action → risk    |
| Coverage loss   | T4 teach mode = human picks | small gain                  |
| Effort          | 0                           | 3-5 wks + new guard + tests |
+-----------------+-----------------------------+-----------------------------+
 PICK  a). Rewrite v5 §6 to the T0-T4 model. Marketing line still true:
       "plans, self-heals, explains; acts through verified tools".
```

### E5 · Who sells VCFO Suite

```
+-----------------+-----------------------------+-----------------------------+
|                 | a) SBC LLP sells            | b) New Pvt Ltd (tech co.)   |
+-----------------+-----------------------------+-----------------------------+
| ICAI Reg 190A   | Needs specific permission;  | CA partners as shareholders;|
|                 | not on general list [W]     | management role → VERIFY    |
| Attest work     | may be restricted for       | SBC keeps attest work       |
|                 | members with other business |                             |
|                 | [W]                         |                             |
| IP              | in the firm                 | assign SBC + devs IP → co.  |
| Investors       | no                          | yes                         |
| SBC as customer | -                           | SBC = tenant #1 (arm's      |
|                 |                             | length licence)             |
| DPDP role       | mixed                       | clean: co. = processor,     |
|                 |                             | each firm = fiduciary       |
| Effort / cost   | 0                           | incorporate + agreements    |
| Reversible      | -                           | medium                      |
+-----------------+-----------------------------+-----------------------------+
 PICK  b). VERIFY with ICAI before incorporation (L1, L2 below).
```

```
 DECISION SHEET (you fill)
+----+-------------------------+-----------+-------------+
| E  | Pick                    | Your call | Date        |
+----+-------------------------+-----------+-------------+
| E1 | c) silo per tenant      |           |             |
| E2 | b) GSP for returns      |           |             |
| E3 | a) remove secrets       |           |             |
| E4 | a) drop AI mode         |           |             |
| E5 | b) new Pvt Ltd          |           |             |
+----+-------------------------+-----------+-------------+
```

---

## Q15 · Legal pack (for your CA / lawyer)

Base: `docs/specs/vcfo-assist-agents/CS-QUESTIONS.md` has 31 questions [F].
Is it sent? `ROADMAP.md` phase 0 exit 3 wants a "date sent". Not recorded [F].

```
 ALREADY IN CS-QUESTIONS.md (send as is)
   MCA ToS Q1 · s.70 Q2 · first live filing Q3 · authority Q5 · DSC Q6-7
   review evidence Q8 · fee Q9 · DPDP Q10 · Aadhaar Q11 · attended fill Q12
   AI labels Q16 · logs Q17 · recorder Q18/31 · other portals Q19
   client AI consent Q20 · PI insurance Q23 · income tax/TRACES Q24-29 · GST Q30
```

```
 NEW (add as Part E) — answer YES / NO, then conditions
+----+-------+--------------------------------------------------------------+
| #  | From  | Question                                                     |
+----+-------+--------------------------------------------------------------+
| L1 | E5,D1 | Reg 190A: may SBC's CA partners own shares in a software     |
|    |       | company that sells VCFO Suite to other firms?                |
| L2 | E5    | May a CA partner be a director of that company? Does it      |
|    |       | affect SBC's attest work?                                    |
| L3 | E5    | May SBC LLP itself license software to other firms?          |
| L4 | D2,E2 | GSTZen GSP contract: who is the ASP? May a tenant firm use    |
|    |       | our ASP for its clients? Liability split?                    |
| L5 | E2    | Per-client GST API consent: is the taxpayer's OTP on "Manage |
|    |       | API Access" enough, or also a written mandate?               |
| L6 | D3    | ERI: which type (1, 2, 3) for a SaaS used by many firms?     |
|    |       | Must each firm hold its own ERI? [W: CA firms eligible]      |
| L7 | F21.2 | UIDAI ADV circular (rev. 18 Jul 2025 [W]): does it apply to  |
|    |       | Aadhaar numbers in our checklist data? Masked too? [W: yes]  |
| L8 | F21.2 | If ADV applies: may we keep only a scanned copy, no number?  |
| L9 | F21.4 | May ID images go to an AI model (Bedrock, India regions)     |
|    |       | with notice + consent? Any Aadhaar bar?                      |
| L10| D5    | DPDP: core duties from ~May 2027 [W]. Our role per tenant:   |
|    |       | processor? SBC: fiduciary? Contract terms needed?            |
| L11| D5    | Retention: how long for each data class (KYC, filings,       |
|    |       | mail, AI logs)? Companies Act 8 yrs vs DPDP erase?           |
| L12| E3    | Before we delete stored client portal passwords: any duty to |
|    |       | keep, notify, or hand back?                                  |
| L13| D8    | OTP relay: may a client read an OTP to staff by phone? (Q25  |
|    |       | asks for tax only — extend to all portals)                   |
| L14| Q34   | CERT-In 6 h: does it bind us as a SaaS provider? Log keep    |
|    |       | 180 days in India — confirm.                                 |
| L15| D14   | SaaS terms: liability cap, indemnity for a wrong filing, AI  |
|    |       | disclaimer — what is enforceable in India?                   |
| L16| D10   | Labour codes (Nov 2025 [A]): register formats we generate —  |
|    |       | valid for inspection?                                        |
| L17| -     | Trademark "VCFO Suite": clearance search + class 9/42.       |
| L18| Q33   | Udyam: "no private agent authorised" [W]. May a firm file    |
|    |       | Udyam for a client at all?                                   |
| L19| Q33   | Income Tax Systems = s.70 protected [F report]. Does an      |
|    |       | attended extension in the user's session change risk?        |
| L20| Q33   | ICEGATE = s.70 protected [F brief]. Same question.           |
+----+-------+--------------------------------------------------------------+
```

```
 SEND ORDER
   1 L1-L3 (blocks E5)    2 L4-L5 (blocks GST build)   3 L7-L9 (blocks PII)
   4 CS-QUESTIONS Q1-Q19 (blocks MCA live)             5 rest
```

---

## Q33 · Portal ToS map

```
+-------------+-----------------------------+---------+-----------+------------------+---------+
| Portal      | ToS on automation           | s.70    | Extension | Source / date    | Status  |
|             |                             | protect.| allowed?  |                  |         |
+-------------+-----------------------------+---------+-----------+------------------+---------+
| MCA V3      | No bot/extension clause.    | Not     | Allowed w/| mcacdm.nic.in    | Report  |
| mca.gov.in  | Bans "unauthorized use",    | found   | conditions| tnc.pdf, 2018-01 | [F]     |
|             | "misuse of passwords",      |         | (attended)| Live V3 text NOT |  VERIFY |
|             | high-volume DB access       |         | → CS Q1-3 | read (403)       |  CS Q1  |
| GST portal  | "only interfaces expressly  | YES     | NO:       | GST notice       | Brief   |
| gst.gov.in  | authorised by GSTN";        | (2020-  | inject =  | 2018-12-05 via   | [F]     |
|             | scraping = s.43; no overlay | 02-04)  | banned;   | TaxHeal; GSTN    |  VERIFY |
|             | GSP route sanctioned        |         | fill = CS | advisory 2023-09 |  CS Q30 |
| e-Invoice / | Same GSTN family [A]        | YES [A] | NO        | brief (hosts)    | [A]     |
| e-Way Bill  |                             |         |           |                  |         |
| Income Tax  | No bot clause seen in       | YES     | Unknown → | incometax.gov.in | [W]     |
| e-filing    | snippets [W]; ERI = API     | (Income | CS Q24    | /webSitePolicies |  VERIFY |
|             | route                       | Tax Sys)|           | 2026-11-14       |  L19    |
| TRACES      | Not read                    | [A] yes | Unknown → | -                | GAP     |
|             |                             | (CPC-TDS| CS Q28    |                  |         |
| Protean TIN | Not read; FVU = official    | ?       | File only | tinpan.protean   | [W]     |
|             | file route                  |         | → CS Q27  | tech.in          |         |
| EPFO        | Not found. Warns members    | ?       | Unknown   | Tribune, HRKatha | [W] GAP |
|             | against third-party agents  |         |           | 2025             |         |
| ESIC        | Not read                    | ?       | Unknown   | -                | GAP     |
| Udyam       | Not found. "No private      | ?       | Doubtful  | secondary sites  | [W]     |
|             | agent authorised" [W]       |         | → L18     | 2026-11-14       |  VERIFY |
| DGFT (IEC)  | "Unauthorized attempts to   | ?       | Unclear   | dgft.gov.in/CP/  | [W]     |
|             | upload/change info"         |         |           | website-policy   |  VERIFY |
|             | prohibited, IT Act          |         |           |                  |         |
| ICEGATE     | Not read                    | YES     | NO pack   | brief            | [F]     |
| State PT /  | 1 per state, not read       | ?       | Per state | -                | GAP     |
| S&E         |                             |         |           |                  |         |
| IP India    | Not read                    | ?       | No pack   | -                | GAP     |
+-------------+-----------------------------+---------+-----------+------------------+---------+
 Rule 1 applies [F SAFETY.md]: unclear = prohibited. Every GAP / VERIFY
 row stays mock-only. All 9 packs are mock-only today [F packs/*.json].
```

```
 ACTION
   1 Read live ToS from an Indian network: MCA V3, incometax, TRACES,
     EPFO, ESIC, Udyam, DGFT. Save PDF + date in docs/specs/mca-connect/
     research_notes/tos/ (one file per portal).
   2 Merge branch claude/focused-lovelace-8ni8yg (GST legal brief).
     Round 2 cites it; it is NOT on main [F].
```

---

## Sources (web)

- ICAI Reg 190A, general vs specific permission: [TaxGuru](https://taxguru.in/?p=966297), [Taxscan](https://www.taxscan.in/top-stories/ca-practice-with-full-time-employment-know-icai-restrictions-with-misconduct-cases-1439256)
- ERI types: [Protean ERI eligibility](https://tinpan.proteantech.in/services/e-return/ereturn-eligibility.html), [Protean ERI process](https://tinpan.proteantech.in/services/e-return/ereturn-regproc.html)
- Income tax policies: [incometax.gov.in website policies](https://www.incometax.gov.in/iec/foportal/using-the-portal/webSitePolicies)
- Aadhaar Data Vault: [UIDAI ADV FAQ](https://uidai.gov.in/images/resource/FAQs_Aadhaar_Data_Vault_v1_0_13122017.pdf), [Khaitan & Co, Dec 2025](https://www.khaitanco.com/sites/default/files/2025-12/ERGO%20-%20Aadhaar%20Data%20Vault%20-%2010%20December%202025.pdf)
- DPDP Rules 2025 dates: [AZB & Partners](https://www.azbpartners.com/bank/indias-digital-personal-data-protection-act-phased-rollout-and-key-compliance-milestones/), [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)
- EPFO agents warning: [Tribune](https://www.tribuneindia.com/news/business/epfo-cautions-members-against-taking-help-from-agents-for-online-services)
- Udyam: [udyamregistration.gov.in](https://udyamregistration.gov.in/)
- DGFT: [website policy](https://www.dgft.gov.in/CP/website-policy)
