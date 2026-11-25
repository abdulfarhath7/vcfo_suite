# Integrations hub (Zoho) gotchas

- Spec: `docs/specs/integrations/ZOHO.md`. Code: `src/lib/integrations/`, `src/db/repositories/integrations/`.
- Zoho answers many errors as HTTP 200 with `{ code: <non-zero> }` (Books, Payroll) or `{ error }`
  (token endpoint) or `response.status = 1` (People). `ZohoClient.get` and `postToken` turn those into throws.
- The consent always starts at accounts.zoho.com; the token exchange must go to the
  `accounts-server` from the callback, or Zoho answers `invalid_code`. Multi-DC must be on in the API console.
- `api_domain` decides the API host (www.zohoapis.in for India). People is the odd one: people.zoho.<dc>.
- Zoho refresh tokens do not rotate; `refresh_token` is absent on refresh replies, so the old one is kept and re-sealed.
- An inline discovery (no Inngest) dies with the process; `systemCreateJob` fails a job older than 20 minutes so it never blocks.
- `ZOHO_JOBS_REGISTERED` in `run-discover.ts` is true because both Zoho functions are in `app/api/inngest/route.ts`; set it false if they are taken out, or events wait for ever.
- Tailwind scans every string in `src/`: a JSX text like `'–'` next to `:` once produced the class `[-:–]` and broke globals.css in dev. Prefer words ("No") over a lone dash in ternaries.
- Sync from Zoho stages through `stageTallyImport` / `stageTallyReceipts` (source `zoho`); the approval panel treats `zoho` like `tally_live`.
