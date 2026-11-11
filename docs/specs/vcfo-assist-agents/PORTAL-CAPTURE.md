# VCFO Assist Agents — how to capture a government portal flow

This guide is for the owner and for staff. It explains how to record one task on a government
portal (for example, a TDS challan on the income tax site) so that Claude can teach VCFO Assist
that task. You do not need to be technical. A developer sets the recorder up once on your laptop;
after that you only walk through the task as you normally would.

The rules behind this guide are in `SAFETY.md` (see "Portal packs and tax tasks"). The open legal
questions are in `CS-QUESTIONS.md`. The design is in `PLAN.md`.

## Two words you will see

**Portal pack.** A portal pack is VCFO Assist's map of one website, such as the income tax
e-filing site, TRACES or the MCA portal. It lists the pages, how to tell which page is open, where
each field and button sits, how long to wait for a page or a dropdown, and where a person must act
(login, captcha, OTP, signing, paying). One pack serves every task on that website, so a site is
captured once and reused. When the website changes a button, the pack is fixed once and every task
on that site works again.

**Task recipe.** A task recipe is the list of steps for one job, such as "Monthly TDS challan
(Challan 281)". It names the portal pack it uses, the pages in order, which VCFO Suite value goes
into which field, and the points where the agent stops and shows a "You do this" card. The person
always does those steps: log in, type the captcha and OTP, sign, e-verify, submit and pay.

## Why we do not want HAR files or saved web pages

Your browser can save a "HAR" file (a network log) or a full copy of a web page. **Please do not
send either one.** They are not safe.

| What | What it can contain | Why that is dangerous |
|---|---|---|
| HAR file (network log) | Session cookies, login tokens, every request and reply the portal sent | Anyone holding it can act as you on the portal until the session ends. It also holds every client detail the portal showed. |
| "Save page as" (full page) | The page as you saw it, with names, PAN, TAN, addresses and amounts, and sometimes hidden tokens | It leaks client data, and it may carry a token that opens your session. |
| Screen recording or phone video | Everything on screen, including the captcha, OTP and typed passwords | It shows secrets and client data, and Claude cannot use it to find fields reliably. |

Claude reads the capture you send. Claude is an outside AI service, so the capture must be safe to
show to an outside service. Under the CA Act, sharing a client's affairs without the client's
consent is misconduct (see the legal review). That is why the capture must hold no client personal
data at all, not just "less" of it.

## Before you start: is capture allowed on this portal?

Recording a live portal is itself a question for the company secretary (questions 18 and 31 in
`CS-QUESTIONS.md`). The firm's rule is that an unclear position counts as prohibited. So the owner
confirms in writing (an email is enough) that capture on this portal may go ahead, and keeps that
email with the capture. If the owner has not confirmed, do not start.

## What you need

| Item | Notes |
|---|---|
| A firm laptop | Not a personal or shared computer. |
| The recorder, set up once by a developer | It lives in `extensions/vcfo-assist/tools/recorder/`. It opens its own Chrome-style window. |
| Your own portal login | Never a client's login, never a colleague's, never a shared ID. |
| The firm's own entity where possible | Use SBC's own TAN or PAN (the firm, not a person) so no client data appears. |
| About 20 to 40 minutes | One task per recording. |

### Setting up the recorder (developer, once per laptop)

1. Install Node.js 20 or later.
2. Open a terminal in `extensions/vcfo-assist/tools/recorder/`.
3. Run `npm install`, then `npx playwright install chromium`.
4. Check that the recorder's `steps/` and `profile/` folders are ignored by git.
5. Show the staff member how to start it (below) and how to close it.

If the `README` in `tools/recorder/` gives different commands, follow the `README`.

## Recording a task, step by step

1. **Close other portal tabs.** Use only the recorder's window for this task.
2. **Start the recorder.** In the terminal, run `node recorder.js` followed by the start address
   from the table at the end of this guide. A browser window opens. It is a normal, visible
   window, and you drive it yourself.
3. **Log in yourself.** Type your user ID, password, captcha and OTP as usual. The recorder hides
   password, OTP and captcha fields in its notes, but the login screen still appears in its
   pictures. You will delete those pictures later (see the checklist).
4. **Walk the task once, at your normal pace.** Open each page the task needs. Open each dropdown
   once so its choices are recorded. If a pop-up appears, read it and close it as you normally
   would. Pause about five seconds on each new page so the recorder saves it.
5. **Type only safe values.** Use the firm's own TAN or PAN and real values you would actually use.
   Never type made-up or dummy values into anything you will save or submit; that is false data on
   a public system (see `SAFETY.md`, guard G16). If a page asks for someone else's PAN, Aadhaar,
   salary or bank details, wait five seconds so the empty page is saved, then close the recorder
   window. Finish the task, if you need to, in your normal browser.
6. **Stop before Submit or Pay.** Never press Submit, File, Pay Now, Pay Later, Make Payment,
   e-Verify, or anything that signs with a DSC. The "first flows" table says exactly where to stop
   for each task.
7. **Log out**, then close the recorder window. Closing the window ends the recording.
8. **Write a short note.** Make a file called `NOTES.txt` in the run folder. Say who recorded it,
   the date, the portal, the task, which entity you used, where you stopped, and anything odd
   (a pop-up, an error, a slow page, a step you repeated).

If you make a mistake, carry on and mention it in `NOTES.txt`, or close the window and start a new
recording. Each start makes a new run folder.

## What the recorder saves

Each recording makes one run folder under the recorder's `steps/` folder, named with the date and
time. A new numbered step is saved each time the page changes.

| File | What it holds |
|---|---|
| `NNNN/page.html` | The page's structure at that step. |
| `NNNN/frame-N.html` | The structure of any frame inside the page. |
| `NNNN/elements.json` | Every field, button and link: its name, label, position and dropdown choices. |
| `NNNN/screenshot.png` | A picture of the page at that step. |
| `NNNN/meta.json` | The page address, title, headings and why the step was saved. |
| `events.jsonl` | What you clicked and changed, in order. |
| `network.jsonl` | The portal's background requests (see below). |
| `downloads/` | Any file the portal let you download. |

### What it hides, and what it does not

| Hidden automatically | **Not** hidden, so you must check |
|---|---|
| Values in password, OTP, captcha, token and secret fields | Values you typed in ordinary fields (names, PAN, TAN, amounts) |
| Cookie and authorization headers in `network.jsonl` | Anything shown on screen in a screenshot, including the captcha picture on the login page |
| Password, OTP, captcha and token entries in request bodies | Names, PAN and addresses the portal itself displays in the page |
| | Other session or security headers, and replies from the portal, in `network.jsonl` |
| | Files in `downloads/` |

The ported recorder may hide more than this. Its `README` is the final word. Even so, always do
the checks below. The recorder's `profile/` folder keeps your logged-in session, so it is never
sent and never zipped.

## Checklist before you send anything

Tick every line. If you cannot tick a line, do not send the capture; ask the owner.

- [ ] I used my own login, and the owner confirmed in writing that capture on this portal is allowed.
- [ ] I did not press Submit, File, Pay, Pay Later, e-Verify or any DSC signing button.
- [ ] I deleted every step folder whose screenshot shows the login page, a captcha or an OTP screen.
- [ ] No password, OTP or captcha text appears in any screenshot I am sending.
- [ ] I looked at **every** screenshot. None shows a real client's name, PAN, TAN, Aadhaar,
      address, phone, email, bank details or amounts. Where one did, I deleted that whole step folder.
- [ ] I deleted the `downloads/` folder.
- [ ] I deleted `network.jsonl`. (Claude will ask for it if it is needed, and the owner then decides.)
- [ ] I am not sending the `profile/` folder, any HAR file, any "saved page" or any screen recording.
- [ ] `NOTES.txt` is in the run folder and says where I stopped.

## Naming and zipping the folder

1. Move the run folder out of the recorder's folder (for example to `Documents/vcfo-captures/`).
2. Rename it like this: `capture-<portal>-<task>-<date>-<initials>`. Use lower case and dashes.

| Example name | Meaning |
|---|---|
| `capture-income-tax-challan-281-2026-11-12-ak` | Income tax e-Pay Tax, Challan 281 (TDS), captured on 12 Nov 2026 by AK |
| `capture-income-tax-challan-280-2026-11-12-ak` | Income tax e-Pay Tax, Challan 280 (advance tax) |
| `capture-traces-form16-request-2026-11-14-ak` | TRACES, Form 16 or 16A download request |
| `capture-mca-spice-part-a-2026-11-20-ak` | MCA SPICe+ Part A re-capture |

3. Right-click the folder and choose "Compress" (or "Send to, Compressed folder"). Keep the same name.

## Where to put it

- Put the zip in a **private location the owner chooses**, such as a private firm folder or a
  private storage bucket that only the owner and the person working with Claude can open.
- **Never** put a capture in the git repository, not even in a branch.
- Never send it by WhatsApp, personal email or a public sharing link.
- Tell the owner where it is. The owner gives Claude the location in a working session.
- The owner decides how long to keep it. We suggest deleting it once the pack is built and checked.

## What Claude does with it

1. **Checks it again.** Claude scans the capture for passwords, OTPs, cookies, tokens, PAN and
   Aadhaar patterns before reading it. If it finds one, it stops and tells the owner.
2. **Builds the portal pack.** The pages, how to recognise each one, the fields and buttons, the
   waits, and every place a person must act.
3. **Builds the task recipe.** The pages in order, which VCFO Suite value goes in which field, and
   the "You do this" stops (login, captcha, OTP, sign, e-verify, submit, pay).
4. **Tests it offline.** Claude replays the recipe against the captured pages on its own machine,
   never on the live portal. The test checks that every field lands, that the guards refuse
   captcha, OTP and password fields, and that Submit and Pay are never clicked.
5. **Keeps it mock-only.** Each pack starts with `legalStatus: "mock-only"`. It cannot run on the
   live portal until the company secretary's written opinion covers that portal and a super admin
   records it in VCFO Suite. Then the pack becomes `cs-cleared`.
6. **Keeps your capture out of git.** Only the pack, the recipe and a cleaned copy of the pages
   (with every value removed) go into the code. The raw capture never does.

## The first flows to capture, in order

| # | Portal and start address | Task | Walk through | Stop at |
|---|---|---|---|---|
| 1 | Income tax e-filing, `https://www.incometax.gov.in/iec/foportal/` | e-Pay Tax, **Challan 281 (TDS/TCS)** | e-Pay Tax, New Payment, the TDS/TCS tile, the tax-applicable and type-of-payment choices (200 and 400), the section (nature of payment) dropdown, the tax breakup page | The **payment mode and bank selection** page. You may pick "Net Banking" and open the bank list. Do not press Continue, Pay Now or Pay Later. |
| 2 | Same site | e-Pay Tax, **Challan 280 (advance tax)** | e-Pay Tax, New Payment, the income tax tile, assessment year, type of payment (Advance Tax, 100), the tax breakup page | The same payment mode and bank selection page. Same rule. |
| 3 | TRACES, `https://www.tdscpc.gov.in/` | **Form 16 or 16A download request** | Downloads menu, Form 16 or Form 16A, financial year and quarter, the KYC page, the Requested Downloads page | The KYC page, once it has loaded **empty**. Then close the recorder. Finish the request, if needed, in your normal browser, because the KYC page asks for real deductee PANs. |
| 4 | MCA, `https://www.mca.gov.in/` | **SPICe+ Part A** re-capture, to refresh the field map | Open the form and move through every section, leaving fields empty where the portal allows it | Any page that needs a client's real details. Do not press Save or Submit. |
| 5 | Same site | **SPICe+ Part B** re-capture | As row 4, section by section | As row 4. |

Notes on the first flows:

- For rows 1 and 2, staff may use e-Pay Tax after logging in, or the quick link on the home page
  that works without a login (PAN or TAN plus an OTP to the registered mobile). Capture the path
  the firm actually uses, and say which one in `NOTES.txt`. Use the firm's own TAN or PAN. Never
  use a client's TAN with an OTP that goes to the client's phone.
- A challan number (CRN) is created when the preview is confirmed. Stopping at the payment mode
  page means no challan is created and nothing is paid.
- Quarterly TDS returns (24Q and 26Q) are not captured. They are built as files from VCFO Suite
  data, and the person checks, uploads and signs them (see `SAFETY.md`).
- GST is not captured for now. Its terms bar "unauthorised interfaces", so GST waits for the
  company secretary's opinion (question 30 in `CS-QUESTIONS.md`).
