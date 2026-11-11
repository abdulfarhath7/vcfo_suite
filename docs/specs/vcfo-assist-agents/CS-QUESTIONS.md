# VCFO Assist Agents — questions for the company secretary

This is the question bundle that phase 0 of `ROADMAP.md` sends to the company secretary (or
counsel). Part A is taken from the eleven open questions at the end of the firm's legal report
(`docs/specs/mca-connect/reports/MCA SPICe filing automation options.md`). Part B adds questions
that only arise from the design in `PLAN.md`. Questions 1, 2, 10, 11 and 16 were updated, and Part C
was added, after the later legal review
(`docs/specs/mca-connect/reports/VCFO Assist legal review.md`, section "How this research confirms
or corrects the earlier work"). Part D covers the income tax portal, TRACES, Protean and GST, which
the agents will reach next. The guards the answers rely on are in `SAFETY.md`.

Fill in the bracketed parts, attach the report, the legal review, the 2018 MCA Website Policies text
and `SAFETY.md`, and send the letter as it stands.

---

**To:** [Name], Company Secretary [or counsel], [membership number]
**From:** [Name], [role], SBC
**Date:** [date]
**Subject:** Written opinion requested on VCFO Assist, an attended form-filling aid for MCA V3 and
the income tax portals

Dear [Name],

SBC is building VCFO Assist, a Chrome extension that helps our own staff fill MCA V3 web forms,
starting with SPICe+ Part A, from data the firm already holds in VCFO Suite. The extension runs
only in the staff member's own browser and in the session they have opened themselves. A person
always logs in, types the captcha and OTP, signs with their own DSC, clicks the final Submit and
pays the fee. The extension never does any of these, stores no credentials and calls no portal
endpoint. Until now we have built and tested it only against a local copy (mock) of the forms;
it has never touched the live portal.

Our internal rules say that no tool may touch the live MCA portal before a written CS opinion,
and that any unclear position counts as prohibited. We would be grateful for a written answer to
each question below. Where the answer is "it depends", please tell us the conditions, and the
records you would expect us to keep. A short answer per question is enough.

### Part A — general questions from our legal research

1. **MCA terms of use.** We attach MCA's "Website Policies" text, read from an official NIC-hosted
   copy dated 2018 (`https://mcacdm.nic.in/docs/tnc.pdf`). It forbids "unauthorized use" and
   "misuse of passwords", and its only clause on automation lets MCA cut off "unusually high
   numbers of daily database accesses". It has no clause on browser extensions, bots or
   third-party software. The live V3 pages could not be opened from our network. Please open the
   live MCA V3 terms from an Indian network and confirm whether they match the 2018 text, or
   whether they add an "authorised interfaces only" or "no automated tools" clause.
2. **Protected system.** Our research found no notification declaring MCA21 a "protected system"
   under section 70 of the IT Act, but it could not search the e-Gazette, so this is "not found",
   not "confirmed absent". Please check the Gazette. If a notification exists, what does it change
   for a tool that fills fields in an attended session?
3. **Approval for a first live filing.** Will you give written approval for VCFO Assist's first
   live filing? If so, on what scope (which forms, which staff members, how many filings) and with
   which logs?
4. **MCA notices.** Has MCA issued any circular, notice or advisory since 2019 on third-party
   filing software, browser extensions, bots or misuse of user IDs? (We found only anti-phishing
   advisories.)
5. **Authority to file.** What authority must a staff member hold to file a client's SPICe+
   under their own Business User ID, and what document should we keep as proof of it?
6. **DSC custody.** May the firm keep a client's DSC token in its office with the client's
   written consent, if only the client types the PIN? (The CCA text says the token stays in the
   subscriber's custody.)
7. **Other ways of signing.** Does MCA accept Aadhaar eSign, a cloud or HSM DSC, or a PDF signed
   in Leegality or emSigner, for SPICe+ or for its attachments? (Only vendor claims exist, and we
   cannot test this on the live portal.)
8. **Review evidence.** When a tool pre-fills SPICe+, what review evidence must the certifying
   professional keep to meet sections 7(6) and 448 and the institutes' due-diligence standard?
9. **Paying the fee.** May the firm pay a client's SRN fee from the firm's own account?
10. **Data protection.** Our understanding of the dates is this. Only the DPDP Act's definitions
    and the Data Protection Board provisions are in force now. Most duties (notice, consent,
    processor contracts, Rule 6 safeguards, Rule 7 breach notice, Rule 8(3) one-year retention, and
    section 16 on transfers abroad) start on or about 13 May 2027. Until then, section 43A of the
    IT Act and the SPDI Rules 2011 apply, and the CERT-In Directions of 28 April 2022 apply now.
    No country is restricted under section 16. Please confirm these dates against the Gazette,
    including any change to the 18-month window. Is the section 3(c)(ii) exemption safe to rely on
    for data taken from MCA registers?
11. **Aadhaar.** Sections 447 (Companies Act) and 72A (IT Act) are now confirmed and need no
    answer. What limits does section 29 of the Aadhaar Act set, in its current text, on storing
    or sharing Aadhaar numbers, and what are the penalties? We intend to store only the last four
    digits and never send an Aadhaar number or image to an AI model.

### Part B — questions specific to the VCFO Assist design

12. **Attended filling in the user's own session.** The staff member opens the MCA portal, logs
    in with their own Business User ID, and types the captcha and OTP. The extension then types
    values into the visible form fields, the same fields the person would type into, after the
    person has seen and confirmed a table of every value it will write. Is this lawful use of the
    portal "with permission", and does it change who is responsible for the content?
13. **Clicks the agent makes.** Apart from typing into fields, the extension clicks only three
    kinds of button: **Save draft**, **Check form** (the portal's own validation) and **Download
    PDF**. It never clicks Login, the final Submit, any payment button, or the DSC signing
    controls. Are these three clicks acceptable? Should any of them stay with the person?
14. **Attaching a signed PDF.** Each signer signs the MCA-generated PDF on their own token. The
    staff member then drops that signed PDF into the extension's panel, and the extension attaches
    it in the portal's upload field without changing a byte. Is it acceptable for the extension to
    perform the upload step, given that a person still clicks the final Submit?
15. **Reading the SRN.** After the person submits and pays, the extension reads the SRN shown on
    the portal page and writes it back to the client's file in VCFO Suite, so that our reminders
    for the 15-day and 7-day limits start. It reads nothing else and calls no portal endpoint. Is
    reading the SRN off the screen acceptable?
16. **Field labels sent to an AI model.** When the portal changes a form and the extension cannot
    find a field, it may send the field **labels** on that page (for example "Proposed name 1",
    "NIC code") and our own field names to an AI model, which picks the matching field from a
    list. No client values are sent: no names, PAN, addresses, numbers or screenshots, and the
    captcha is never read. The model is Anthropic's Claude Haiku, reached either through
    Anthropic's API (processing is "global"; Anthropic offers no India option) or through Amazon
    Bedrock. On Bedrock, only the India cross-region profile (model IDs starting `in.`) keeps
    processing in Mumbai (ap-south-1) and Hyderabad (ap-south-2), and as of September 2026 it
    supports only Claude Opus 5, Sonnet 5 and Haiku 4.5. A plain or `global.` model ID may be
    processed outside India even when called from Mumbai, and our current Bedrock code uses such
    IDs. Does sending labels only, with no client values, need a DPDP processor contract, a client
    notice, or the `in.` profile?
17. **Screenshots and logs.** For each run, VCFO Suite keeps a log of every field filled, every
    refusal and every human step, with who prepared, who reviewed and who signed. It can also keep
    a screenshot of a portal page at chosen steps, stored on the firm's own AWS account in India.
    Is this the right record for question 8? How long should we keep it, given the CERT-In
    180-day rule?
18. **Learning the forms.** To build our mock of the forms, a staff member files as usual while a
    passive recorder extension notes the structure of each page (field names, labels, buttons). It
    stores no values, passwords or request bodies. Is that acceptable on the live portal?
19. **Other portals.** If the answers above are favourable for MCA, may the same design be used
    on gst.gov.in, udyamregistration.gov.in, dgft.gov.in and state portals, or does each portal
    need its own review of its terms?

### Part C — questions added after the legal review

20. **Client consent for AI.** Under Clause (1), Part I, Second Schedule of the CA Act, may our
    Ask VCFO assistant send a client's facts to an AI processor if the client has given written
    consent? If so, on which route: Anthropic's API (outside India, with its data processing
    addendum and, if agreed, zero data retention), or Amazon Bedrock's India profile with
    retention set to none? What should the consent say?
21. **Director data uploaded personally.** May SBC rely on section 7(a) of the DPDP Act
    ("voluntarily provided") for data a director uploads personally in our client portal, or must
    we take a notice-and-consent from each director? For data the client company passes to us
    about its directors, we assume consent is needed. Is that right?
22. **Joint or independent fiduciaries.** For director data, are SBC and the client company
    independent data fiduciaries or joint fiduciaries? How should the engagement letter split the
    notice, rights and breach duties between us?
23. **Professional indemnity insurance.** Does a typical professional indemnity policy for a CA or
    CS firm cover tool-assisted filing, staff dishonesty, disciplinary defence costs and cyber
    incidents? What should we ask our insurer to confirm in writing?

### Part D — Income tax, TDS and Protean

We plan to extend the same attended design to recurring tax work. A person always logs in with
their own ID, types any captcha and OTP, e-verifies or signs, and pays. The agent never does any
of these.

24. **Terms of use.** Do the terms of use of the income tax e-filing portal
    (incometax.gov.in) and of TRACES (tdscpc.gov.in) permit a browser extension that fills visible
    fields in the user's own session? Do they bar automated tools or "unauthorised interfaces"?
    Please read the live texts from an Indian network.
25. **Whose login.** To prepare a TDS or advance tax challan for a client, which login may our
    staff member use: the client's own e-filing login, the quick e-Pay Tax link (the client's PAN
    or TAN, with an OTP sent to the client's registered mobile), or the firm's own login as an
    authorised representative or tax professional? May the client read the OTP to our staff
    member by phone, or must the client type it on their own device?
26. **Attended pre-filling of Challan 280 and 281.** On the income tax e-Pay Tax page, in the
    user's own session and with the person who will pay present, the extension would fill the
    challan fields from our records: the PAN or TAN, assessment year, type of payment, section
    (nature of payment) and the tax breakup. It would stop before the payment mode and bank
    selection page. The person checks the preview, creates the challan, and pays through their own
    bank. Is this acceptable?
27. **Quarterly TDS returns (24Q and 26Q).** We would build the return file from the firm's own
    payroll and payment records, in the format that Protean's Return Preparation Utility produces,
    for validation by Protean's File Validation Utility (FVU). The person runs the FVU, uploads the
    file through the e-filing portal or a TIN facilitation centre, and signs with their own DSC or
    EVC. The agent never uploads or signs. Is this acceptable? Do Protean's terms place any
    condition on files built by third-party software?
28. **Form 16 and 16A from TRACES.** In the deductor's own TRACES session, may the extension fill
    the request form (financial year, quarter, form type) and the KYC page from our records (the
    return's token number, challan details, and PAN and amount pairs), and later download the
    requested file? The person logs in and types the captcha. Whose TRACES login may our staff
    member use for a client's TAN?
29. **E-verification.** Our design keeps every e-verification with the person: EVC, Aadhaar OTP,
    net-banking verification and DSC. The agent never clicks e-Verify, never reads or routes an
    OTP, and never touches a DSC. Is that enough? May our staff ever e-verify on a client's behalf
    with the client's OTP, or must the client always do it?
30. **GST portal.** The GST portal's user agreement allows access only "through the interfaces
    expressly authorised by GSTN" and calls scraping an offence under section 43 of the IT Act. Does
    attended filling of visible fields in the user's own session count as an "unauthorised
    interface"? Until you answer, our GST agents only prepare data in VCFO Suite, and the person
    types it into the portal. Is that safe? Is a GST Suvidha Provider (GSP) route the only lawful
    way to automate GST work?
31. **Recording the tax portals.** As in question 18, to learn the forms a staff member would walk
    through a task once while a passive recorder notes the page structure (field names, labels,
    buttons and pictures of each page). They use their own login and the firm's own TAN or PAN,
    stop before payment or submission, and delete any screen that shows a password, captcha, OTP or
    a client's details before the recording leaves their laptop (see `PORTAL-CAPTURE.md`). Is that
    acceptable on the income tax portal and on TRACES?

We would be grateful for your answer by [date]. Until we receive it, the extension stays
switched off for every live portal, and we continue testing only against the mock.

Yours sincerely,
[Name]
[Role], SBC

Enclosures: the legal report on SPICe+ filing automation options; the VCFO Assist legal review;
MCA's 2018 Website Policies text; the VCFO Assist safety guards (`SAFETY.md`); the portal capture
guide (`PORTAL-CAPTURE.md`).

---

## After the reply

| Step | Who | Where |
|---|---|---|
| Record the opinion's date, author, scope (forms, users, hosts) and conditions. | Super admin | Suite, live-portal switch (see `SAFETY.md`, G11) |
| Turn any condition into a guard, a test or a log field before the switch is turned on. | Developer | `SAFETY.md`, the guards module |
| Move phase 4 of `ROADMAP.md` from blocked to ready, or record why not. | Owner | `ROADMAP.md` |
| For each portal the opinion covers, move its portal pack from `mock-only` to `cs-cleared`; leave every other pack as it is. | Super admin, Developer | Suite, per-pack live switch (see `SAFETY.md`, "Portal packs and tax tasks") |
