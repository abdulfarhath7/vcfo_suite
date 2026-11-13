# Receivables: putting Summit Consulting live on app.sbctrack.in

Written 13 Nov 2026 for whoever holds the AWS login (a person or a local Claude Code session with
the AWS CLI). The cloud session that built this could not reach the production database, which is
private. Everything below was run on a local Postgres 16 first.

## What the owner asked for

1. A login for `phanisaiteja.m@sbcllp.in` as a manager and for `jeyansh@sbcllp.in` as a project
   lead, both able to work in the receivables section.
2. The current Summit invoices loaded into it. No client partner logins yet; the two of them will
   create those later from the Partners tab.

## What is on the branch `claude/eloquent-turing-to16z2`

- **A project lead can be given a receivables sheet.** Until now only the sheet's one manager and
  the firm-wide admins could open a sheet. The new table `receivable_sheet_editors` names extra
  staff per sheet (migration `0057_receivables_sheet_editors`, additive). The rule lives in
  `src/db/repositories/receivables/shared.ts` (`canEditSheet`); the list of roles allowed through
  the door is `src/lib/receivables/roles.ts`. A lead who is on no sheet sees "No receivables sheet
  is assigned to you". The lead's sidebar gains a Receivables link, as the manager's already has.
- **`npm run receivables:provision-summit`** (`scripts/provision-summit-receivables.ts`). It
  creates the two profiles if they are missing, the "Summit Consulting" sheet with Phani as its
  manager, Jeyansh as an editor, and the invoices in
  `scripts/data/summit-receivables-oct-nov-2026.json`. It skips anything that already exists, so
  it is safe to run again. It publishes nothing and reminders stay off.
- **The data file**: 43 invoices read from the signed PDFs (SCSPL/26-27/130 to 166 and the
  October reimbursement invoices). 29 are in rupees, total ₹7,64,61,624; 14 are in US dollars,
  total $630,233.41, booked at ₹95.25 (the rate the October trackers use; change it with
  `--usd-rate`). Every invoice is loaded as open, because the pack does not say which are paid.

## Steps on production

Do them in this order. The code must be deployed before the script runs, because the lead's access
depends on the new table and the new rule.

1. **Merge the branch to `main`.** Ask the owner for the pull request title first (CLAUDE.md rule 9).
2. **Snapshot RDS**, as before every migration (name it like `vcfo-suite-db-pre-0057-<date>`).
3. **Open the tunnel and apply the migration** (see `docs/context/AWS-DEPLOY.md` section 11.3):

   ```bash
   node scripts/db-env-prod.mjs
   ```

   Run the port-forward command it prints in a second terminal, paste the exports it prints into
   the first, then:

   ```bash
   npm run db:migrate
   ```

   If RDS is behind 0057 by more than one migration, this applies every pending one. Check
   `docs/context/STATE.md` for the notes on each before going ahead.
4. **Deploy `main` to App Runner** the usual way (build, push `:latest` to ECR; `infra/README.md`).
5. **Dry run the setup through the same tunnel**, and read the output:

   ```bash
   npm run receivables:provision-summit -- --dry-run
   ```

   It should say it would create two profiles, one sheet, one editor and 43 invoices. If a
   "Summit Consulting" sheet already exists on production it says so and reuses it; if that sheet
   has a different manager, stop and ask the owner.
6. **Run it for real**:

   ```bash
   npm run receivables:provision-summit
   ```

   It prints a temporary password for each new login once, at the end. Give each person theirs
   privately. They sign in at `https://app.sbctrack.in/login` and change it under Account
   settings. There is no email reset for staff yet.
7. **Check**: sign in as each person and open `https://app.sbctrack.in/receivables/manager`. The
   Sheet tab should show 43 invoices in October and November blocks.

## What the two of them should do first

- **Review five rows before the first Update.** The script lists them:
  - `R/IE/01` and invoice 146 bill IE ANSR the same transport service for the same ₹32,44,654;
    one of them probably does not stand.
  - `R/R/04` ($7,188) repeats expenses already inside Routeware invoice 159.
  - Invoices 145 (Bupa), 147 (Bonterra) and `R/RT/02` (Raptor) each had an earlier version; the
    later one was loaded.
- **Mark the paid ones received.** Everything is loaded as open.
- **Add client partners** on the Partners tab and assign invoices to them. Reminders need a
  partner on the invoice and stay off until switched on in the Reminders tab.
- **Click Update** only when the sheet is right. Nothing reaches a client before that.
- Phani should connect Outlook once, so that summary emails and reminders go from his mailbox.

## Not in this load

- Invoice 144 (Inspired, September, ₹33,51,351 in the register) has no PDF in the pack.
- Invoice 140 was never issued.
- The ANSR invoices for October had not been raised when the pack was made.
