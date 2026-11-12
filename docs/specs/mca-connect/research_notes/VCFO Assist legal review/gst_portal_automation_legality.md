# Legality of AI-prepared data and attended auto-fill on the GST portal (reg.gst.gov.in), India, as of 12 November 2026

This note is the GST counterpart to `mca_automation_legality.md`. It collects the texts a lawyer or
company secretary needs to answer question 30 in `docs/specs/vcfo-assist-agents/CS-QUESTIONS.md`.
It is research, not legal advice. Every quote comes from a secondary source because the GST portal
blocks automated readers (see section 1). A lawyer should open the primary pages from an Indian
network before signing off.

## Key findings

1. GST is a stricter case than MCA. The GST portal's User Agreement limits access to "interfaces
   expressly authorised by GSTN", bans "overlaying or otherwise modifying the GST portal or their
   appearance", and treats anything that contravenes GSTN's "access controls/Service use limits" or
   "any security feature" as an unauthorised activity. MCA's terms have none of these clauses.
2. The GST database and its associated infrastructure at GSTN were declared a **protected system
   under s.70(1) of the IT Act** with effect from 4 February 2020. Unauthorised access, or an
   attempt at it, carries up to ten years' imprisonment. MCA21 has not been notified, as far as the
   MCA review found. This is the main reason GST needs a written opinion before any on-page tool.
3. GSTN's only sanctioned machine route is GSP to ASP to the GST System, with the taxpayer's OTP
   consent under My Profile → Manage API Access. GSTN warned GSPs (reported September 2023) that
   scraping and "unauthorized BOTs" breach its IP rights and the GSP agreement.
4. No statute, rule, GSTN advisory or judgment was found that addresses a browser extension filling
   visible fields in a taxpayer's own, attended session. The question is open.
5. Market practice: several Chrome Web Store extensions fill GST portal logins or bulk-download
   returns from a logged-in tab (GST Login Autofill, Taxpert GST Login, Finexo Login Tool, GST
   Credential Manager, XLSDEAL GSTR-N). No GSTN enforcement against them was found. That is evidence
   of tolerance, not of legality, and credential filling is the riskier pattern (IT Act s.66C).
6. New registration (REG-01) is filed by the applicant: Part A OTPs go to the applicant's own
   mobile and email, Aadhaar authentication (or biometrics at a GST Suvidha Kendra) is personal, and
   the application is signed by DSC or EVC. Rule 83(8) lets an enrolled GST practitioner amend or
   cancel a registration, but it does not list a fresh registration application.
7. Preparing data in VCFO Suite and letting the person copy it into the portal (clipboard) touches
   no GST page and engages none of the clauses above. It is the safe option today.

## 1. What could and could not be read directly

- `reg.gst.gov.in/robots.txt` redirects to `www.gst.gov.in/error/notfound`; there is no robots file.
- `www.gst.gov.in`, `services.`, `return.`, `payment.`, `einvoice1.` and `ewaybillgst.gov.in` sit
  behind an F5 bot-defence challenge ("TSPD") and reject or reset non-browser clients. That
  challenge is itself a "security feature developed by GSTN" in the sense of the User Agreement.
- `tutorial.gst.gov.in/robots.txt` reads `User-agent: * / Allow: /` and covers only the user manuals.
- The live policy page is `https://www.gst.gov.in/policies/website` (named in GSTN's 2023 advisory).
  It was not read directly. The text below is as reproduced on 5 to 15 December 2018.

## 2. GST portal User Agreement (as reproduced from the 5 December 2018 update)

Source: [TaxHeal, reproducing the GST portal notice of 05.12.2018](https://www.taxheal.com/scrapping-of-gst-portal-site-is-strictly-prohibited-gstn.html);
[KnowYourGST, 15 December 2018](https://www.knowyourgst.com/news/gst-portal-updates-use-policy-terms-and-conditions-to-avoid-data-scrapping-17);
[Taxscan, 10 December 2018](https://www.taxscan.in/gst-portal-website-policy-scrapping/31359).

- Portal notice: "We have updated our website policy. As per this Scrapping of GST Site is strictly prohibited."
- Definition: "Unauthorised activities: The term Unauthorised activities includes any activity which
  is punishable under section 43 (for eg web scraping, altering source code, hacking, introducing
  viruses etc.) and Section 45 of the Information Technology Act, 2000 ... or which have been defined
  as offence under Chapter XI of The IT Act and/or any other activity which is prohibited under any
  Act, rules, regulations having force of law in India and/or any activity which contravenes access
  controls/Service use limits set by GSTN on the GST Portal and/or any security feature developed by
  GSTN on the GST Portal and/or any activity which is contrary to any other policies of the GST Portal."
- Permitted use: "GST Portal shall not in any manner be used for any unauthorized activity(ies)."
- Permitted use: "The Services provided on the GST Portal shall be accessed only through the
  interfaces expressly authorised by GSTN or on the GST Portal."
- The nine listed prohibitions. Users shall not:
  1. imply or state any affiliation with or endorsement of GSTN without its direct and express consent;
  2. manipulate identifiers to disguise the origin of any message or post sent through the portal;
  3. monitor the portal's availability, performance or functionality for any competitive purposes;
  4. **overlay or otherwise modify the GST portal or its appearance;**
  5. remove, cover or obscure any advertisement on the portal;
  6. rent, lease, loan, trade, sell or resell access to the portal or its data;
  7. **sell, sponsor or otherwise monetise any GST portal Service or feature without GSTN's direct and express consent;**
  8. solicit or collect email addresses or other personal information of portal or GSTN users;
  9. use, disclose or distribute any data obtained in violation of the policy.
- Acceptance and enforcement: "By accessing GST Portal it is deemed that you have given your consent
  to this User Agreement"; "Any contravention of this User Agreement shall be viewed strictly and
  appropriate Criminal/ Civil action will be initiated in accordance with the applicable laws."
  Indian law governs, and GSTN may change the agreement at any time.

### Reading the clauses against an attended auto-fill extension

| Clause | How it could catch an extension | Argument for the extension | Design consequence |
|---|---|---|---|
| "accessed only through the interfaces expressly authorised by GSTN or on the GST Portal" | An extension is a third-party interface GSTN never authorised. | The person is using the portal's own page ("on the GST Portal"); the extension only types into it, like browser autofill or a password manager. | This is the central question for the lawyer. |
| "Overlaying or otherwise modifying the GST portal or their appearance" | Injected buttons, banners, highlights or side panels inside the page change its appearance. | Writing a value into an input field the portal offers is use, not modification. | No UI may be injected into GST pages; any panel must live in the browser's side panel or popup. |
| "contravenes access controls/Service use limits ... any security feature" | CAPTCHA, OTP, login, the F5 bot challenge and rate limits are all access controls or security features. | An attended extension that never touches them, at human speed, does not contravene them. | Never fill or read CAPTCHA, OTP or passwords; stop if the bot challenge appears; one action per click. |
| "Selling ... or otherwise monetising any GST portal Service or feature" | Charging clients for a GST auto-fill feature could be called monetising a portal feature. | The firm sells professional services, not access to the portal. | Do not price or market GST auto-fill as a product feature until the opinion is in. |
| s.43 parenthetical "web scraping" | Reading page structure or data from the portal. | Reading only field labels of the user's own form is not scraping. | Read labels only; never read or store other pages, other taxpayers' data or search results. |

## 3. GST database as an IT Act s.70 protected system

- The Ministry of Finance declared "the Goods and Services Tax Database and its associated
  infrastructure dependencies installed at Goods and Services Tax Network ("GSTN") as protected
  system under Section 70(1) of the Information Technology Act, 2000", notification dated and
  effective 4 February 2020. — [A2Z Taxcorp](https://a2ztaxcorp.com/mof-declares-gst-database-as-protected-system-under-information-technology-act/);
  [Taxscan](https://www.taxscan.in/finance-ministry-notifies-gst-database-protected-system-under-information-technology-act/47699).
  Gazette link given by A2Z: `http://egazette.nic.in/WriteReadData/2020/215920.pdf` (not read; the
  S.O. number and exact wording must be checked there).
- Persons authorised to access the protected system: designated GSTN employees; designated tax
  officers of the Centre, States and Union territories, auditing agencies and accounting
  authorities; authorised staff of the managed service provider or third-party vendors; and "GSTN
  authorized business partner(s)" (A2Z's reproduction).
- s.70(3): securing or attempting to secure access to a protected system in contravention of the
  section is punishable with imprisonment up to ten years and fine. —
  [Income Tax India, IT Act s.70](https://www.incometaxindia.gov.in/w/section-70-110).
- CBIC's ICEGATE, ECCS and ACES-GST systems were later declared protected systems as well
  (reported notification of 2 January 2026). — [TaxGuru](https://taxguru.in/goods-and-service-tax/customs-gst-portals-declared-protected-systems-information-technology-act.html);
  [A2Z Taxcorp](https://a2ztaxcorp.net/government-declares-icegate-eccs-and-aces-gst-systems-as-critical-information-infrastructure/).

Analysis: taxpayers are not in the authorised list, yet they use the portal every day, so the
notification must be read as protecting the back-end database and infrastructure, with taxpayers
reaching it lawfully through the portal under the GST law. On that reading, a person filling their
own form, with or without an input tool, does not "access the protected system" in the s.70 sense.
But the notification is what turns a contractual breach of the User Agreement into a potential
criminal question with a ten-year ceiling. No case applying s.70 to a taxpayer-side tool was found.

## 4. GSTN advisories on automation and API access

- Scraping advisory to GSPs (reported 9 September 2023), "Malpractices of scraping GST Common
  Portal for undue gains": "Malpractices like scraping the GST Common Portal or unauthorized BOTs
  etc., not only defeats such premise, but also are serious security threat to the core system,
  breach of GSTN's IP rights and the GST Suvidha Provider agreement." "GSTN reserves its right to
  take appropriate action if such instances come to its notice." —
  [TaxGuru](https://taxguru.in/goods-and-service-tax/gstn-warns-unauthorized-scraping-gst-common-portal.html);
  [GSTClub](https://gstclub.in/news/1259/GSTN-warns-against-unauthorized-scraping-of-GST-Common-Portal).
- GSP framework: the GST System gives API access to GSPs only, over MPLS; ASPs reach it through a
  GSP. — [GSP Implementation Framework v3.0](https://gstn.org.in/assets/mainDashboard/Pdf/GSP_Implementation_Framework_V_3.0.pdf).
- Taxpayer Advisory on upcoming security enhancements, 17 July 2025: email and SMS alerts on every
  ASP OTP consent, and a view to see and revoke ASP/GSP access. —
  [GSTN advisory PDF](https://www.gstindiaonline.com/pages/gstlegislation/GSTN%20Guides/GSTN_Guides_Pdf/2025/Taxpayer%20Advisory%20on%20upcoming%20security%20enhancements.pdf).
  Reported live from the October 2025 deployment under My Profile → Manage API Access. —
  [Tally](https://tallysolutions.com/gst/gst-asp-consent-what-is-it-and-how-will-it-work-for-taxpayers/);
  [GST India Guide](https://gstindiaguide.com/gst-compliance-manage-api-access/).
- Advisory 618 (December 2023): login OTP when the device, browser or location changes. —
  [A2Z Taxcorp](https://a2ztaxcorp.com/gstn-issued-important-advisory-on-two-factor-authentication-for-taxpayers-to-strengthen-login-security-in-gst-portal/).
- A blog reports mandatory OTP-based MFA for all GST logins from October 2026; no GSTN source was
  found. — [Khanna & Associates](https://khannaandassociates.com/blog/gst-e-invoice-multi-factor-authentication-new-rules-compliance-checklist-for-businesses-october-2026/).
- No GSTN advisory on browser extensions or credential-filling tools was found in 2025 or 2026.

## 5. GST law on who files a registration and who is responsible

- Part A of REG-01 is verified by OTPs to the applicant's own mobile and email; Part B needs
  Aadhaar authentication of the promoter or authorised signatory (Rule 8(4A)), or biometric
  authentication with a photograph at a GST Suvidha Kendra when the risk engine flags the
  applicant. — [Taxscan, biometric advisory](https://www.taxscan.in/gstn-issues-advisory-biometric-based-aadhaar-authentication-amp-document-verification/488891);
  [TaxO, February 2025](https://taxo.online/latest-news/10-02-2025-gstn-issued-advisory-for-biometric-based-aadhaar-authentication-and-document-verification-for-gst-registration-applicants-of-maharashtra-and-lakshadweep/).
- The application is verified by DSC (mandatory for companies and LLPs) or EVC (Rule 26).
- Rule 83(8) lists what an enrolled GST practitioner may do for a registered person once authorised
  in FORM GST PCT-05: returns and statements, cash-ledger deposits, refunds, "an application for
  amendment or cancellation of registration", e-way bill information, ITC-04, and composition
  intimations. A fresh registration is not on the list, and the registered person must confirm
  refund, amendment and cancellation applications. — [TaxHeal, Rule 83](https://taxheal.com/rule-83-cgst-rules-2017.html);
  [StudyCafe](https://studycafe.in/rule-83-cgst-rules-provisions-relating-goods-services-tax-practitioner-16565.html).
  Clause lettering differs between compilations; check the CBIC text.
- s.48(3): authorising a practitioner does not shift the registered person's responsibility.
- s.122(1) penalises furnishing false information about registration particulars, at application
  or later; s.29 allows cancellation of a registration obtained by fraud or wilful misstatement.
  An AI error that reaches the portal is the signatory's filing.

## 6. IT Act and data law (same as the MCA note, with GST differences)

- s.43 and s.66: the analysis in `mca_automation_legality.md` section 3 applies. The GST difference
  is that the owner (GSTN) has expressly narrowed its permission to authorised interfaces, so the
  "within the user's permission" argument that carries the MCA note is weaker here.
- s.66C: filling another person's GST password, or acting in a client's login, is the strongest
  risk. The existing credential vault in VCFO Suite must never feed an automated login.
- DPDP Act 2023 and Rules (notified November 2025, full obligations by about May 2027) and Aadhaar
  Act s.29: see `data_protection_india.md`. Mask Aadhaar; do not send client documents to an AI
  model without a processor contract and client notice. — [IAPP](https://iapp.org/news/a/notes-from-the-asia-pacific-region-india-releases-dpdpa-rules-ai-governance-guidelines).
- India AI Governance Guidelines (MeitY, 5 November 2025) are voluntary; they stress human
  oversight and accountability and add no portal-specific rule. —
  [Legal500](https://www.legal500.com/intelligence/india/technology/meity-releases-guidelines-on-ai-governance-%E2%80%93-the-way-ahead-and-roadmap-for-ai-use-in-india).

## 7. Market precedent

- GST Login Autofill fills the GST user ID and password for many clients, CAPTCHA typed by hand. —
  [Chrome Web Store](https://chromewebstore.google.com/detail/gst-login-autofill/lckpkhdlkdolmffaokfdngemafnelkbe?hl=en)
- Taxpert GST Login opens the portal from the Taxpert practice app and fills saved credentials. —
  [Chrome Web Store](https://chromewebstore.google.com/detail/taxpert-gst-login/imbfhbknaohmjbinhblbpjaghdldlhcn)
- Finexo Login Tool, GST Credential Manager, XLSDEAL GSTR-N (bulk download of GSTR-1, 2B and 3B
  from the user's logged-in tab). — [Finexo](https://chromewebstore.google.com/detail/finexo-login-tool/pmnhmhojalnidcfopfgbfjeedagjacil?hl=en);
  [GST Credential Manager](https://chromewebstore.google.com/detail/gst-credential-manager/bjgoclnaikhcakddfddjalaoelgmhgif);
  [XLSDEAL GSTR-N](https://chromewebstore.google.com/detail/xlsdeal-gstr-n/pahjibbljmegbeapcjpfogmjomdhlamp)
- No GSTN enforcement against any of these was found. No tool was found that fills the REG-01
  registration form itself.

## 8. Indian case law

No judgment on browser automation, RPA, extensions or scraping of the GST portal was found. The
closest authority remains the Supreme Court's IRCTC ruling (Inspector, RPF v. Mathew K. Cherian,
2025 INSC 51), discussed in `mca_automation_legality.md` section 6: courts punish fake or multiple
IDs and getting around portal limits under sector statutes. GST has no equivalent of the Railways
Act s.143 offence, but it does have the s.70 protected-system notification.

## 9. Classification for VCFO Suite (pending the lawyer's opinion)

| # | Act | Classification | Basis |
|---|---|---|---|
| 1 | AI reads uploaded client documents and fills a REG-01 data sheet inside VCFO Suite | Allowed with conditions | No GST system is touched. Conditions: DPDP consent and processor contract for the AI provider; Aadhaar masked; staff review every field. |
| 2 | Suite copies one value at a time to the clipboard; the person pastes it into the portal | Allowed | The person is the only one using the portal. Clear the clipboard after a short time. |
| 3 | Suite shows a link that opens the right portal page | Allowed | Ordinary hyperlinking. |
| 4 | Extension types values into visible REG-01 fields when the logged-in applicant clicks, with no UI injected into the page, no Submit, at human speed | Needs legal opinion | "Authorised interfaces only", the s.70 notification, and no authority either way. |
| 5 | Extension injects buttons, highlights or panels into GST pages | Prohibited | "Overlaying or otherwise modifying the GST portal or their appearance". |
| 6 | Extension fills login, CAPTCHA or OTP, solves CAPTCHA, or works around the bot challenge | Prohibited | Contravenes access controls and security features; s.43; s.70 risk. |
| 7 | Staff log in with a client's credentials, or a tool fills stored client passwords | Prohibited for automation; a practice risk even by hand | s.66C; Rule 83 gives practitioners their own login, not the client's. |
| 8 | Headless or unattended runs, batches across clients, scraping search or other taxpayers' data | Prohibited | Scraping and "unauthorized BOTs" (GSTN advisory); s.43(b) and (e). |
| 9 | Returns, GSTR-2B pulls and other API work through a licensed GSP with taxpayer OTP consent | Allowed with conditions | The GSTN-sanctioned route. Needs a GSP contract and per-client consent. |

## 10. Questions for the lawyer (sharpening question 30)

1. Does an extension that types values into visible fields of the applicant's own REG-01 session,
   on the applicant's click, count as accessing the Services through an interface not "expressly
   authorised by GSTN", or is it use "on the GST Portal"?
2. If it is permitted, does the 4 February 2020 s.70 notification change anything for a taxpayer-side
   tool that never calls GSTN endpoints directly? Please check the Gazette text (S.O. number) for any
   condition on how authorised users may access the system.
3. Does filling input values amount to "overlaying or otherwise modifying the GST portal or their
   appearance", or does that clause reach only injected UI?
4. Would offering GST auto-fill to clients as part of paid services be "monetising any GST portal
   Service or feature without GSTN's direct and express consent"?
5. May firm staff, logged in as the applicant with the applicant present and entering the OTPs,
   fill Part B for a new registration, given Rule 83(8) does not list fresh registration?
6. Is a written request to GSTN for express authorisation of an attended input tool worth making,
   and to whom (GSTN's Chief Information Security Officer or its legal team)?
7. Is the clipboard copy approach (row 2) free of all the concerns above?

## Gaps

- The live `gst.gov.in/policies/website` text, the REG-01 page terms, and the 2020 Gazette
  notification were not read directly. The User Agreement text dates from December 2018.
- No primary GSTN source was found for the reported October 2026 MFA mandate.
- Indian Kanoon was not searched exhaustively for s.43, s.66 or s.70 cases involving GST.
