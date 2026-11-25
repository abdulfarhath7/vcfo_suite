# Integrations hub: Zoho (Z1)

Status: built locally on 25 Nov 2026 (hub, discovery, auto map, field check, Sync from Zoho on
receivables), migration `0071_integrations_zoho` applied locally only, not deployed, not tried
against a real Zoho account. Plan: PLAN D3, D2 and D
(owner, 25 Nov). One firm-side connection, made once by a super admin or admin from
Firm settings > Integrations. Read only.

## Flow

```
 [Connect Zoho] ─► accounts.zoho.com consent (read scopes: Books, Invoice, CRM, Payroll, People)
      ▼  callback carries location + accounts-server; token reply carries api_domain (all stored)
 Discover (job): each app's organisations, counts, one sample record per app (field check)
      ▼
 Auto map: GSTIN, then PAN, then normalised name (client-key.ts) ─► mapped / suggested / not mapped
      ▼
 Match clients screen: Accept all · pick or ignore ─► integration_links
```

## Parts

| Part | Where |
|---|---|
| Tables | `src/db/schema-integrations.ts`: `integration_connections`, `integration_orgs`, `integration_links`, `integration_sync_jobs` (`target_key` = one active job per sheet); `receivable_sheets.source` (excel, tally, zoho), `zoho_app`, `zoho_org_id`. Migration `0071_integrations_zoho`, additive only |
| Repository | `src/db/repositories/integrations/` (`access.ts`, `connections.ts`, `hub.ts`) |
| Token sealing | `src/lib/integrations/token-crypto.ts` (AES-GCM on AUTH_SECRET, AUTH_SECRET_PREVIOUS for rotation); Outlook re-exports it |
| Datacenters | `src/lib/integrations/zoho/dc.ts` (ported from @wanasapps/zoho-auth, MIT) |
| OAuth | `src/lib/integrations/zoho/oauth.ts`; routes `app/api/integrations/zoho/{connect,callback,disconnect}` |
| Client | `src/lib/integrations/zoho/client.ts`: refresh on 401, 429 backoff, 100 calls/min per org, Books and CRM paging |
| Readers | `books.ts` (also Invoice), `invoice.ts`, `crm.ts` (v8), `payroll.ts` (v1), `people.ts` |
| Discovery | `discover.ts` (pure), `run-discover.ts` (Inngest, or inline when Inngest is not reachable), `src/jobs/integrations-zoho.ts` (`zohoDiscover`, `zohoReceivablesSync`, both registered) |
| Auto map | `automap.ts` (pure) |
| Books mapper | `books-map.ts`: invoices (not draft or void, total × exchange rate) and payments (one row per applied invoice, ref `zoho:<payment>:<invoice>`) to the Tally live staging rows |
| Receivables sync | repository `src/db/repositories/receivables/zoho-sync.ts`; runner `src/lib/integrations/zoho/run-receivables.ts`; staging reuses `stageTallyImport` / `stageTallyReceipts` with source `zoho`; routes `app/api/receivables/sheets/[id]/{source,zoho/sync,zoho/jobs/[jobId]}` |
| Sheet tab | `sheet/SourceSync.tsx` picks `TallySync` (excel, tally) or `ZohoSync` (zoho); shared dialog and finish logic in `sheet/sync-shared.tsx`; hook `src/hooks/use-zoho-sheet-sync.ts` |
| Status API | `GET /api/integrations/zoho`, `POST .../discover`, `GET/POST .../links` |
| UI | `src/views/firm-settings/zoho/ZohoIntegration.tsx` inside IntegrationsSection |

## Rules

- Only `isFirmWideAdmin` manages the connection, its orgs, links and jobs. A module reading the org
  mapped to a client uses `mappedOrgForEngagement`, which needs `assertEngagementAccess`; clients
  are refused.
- The client secret is only sent to one of Zoho's accounts hosts; an `api_domain` that is not a
  `*.zohoapis.*` host is refused.
- Customers are matched only inside the firm's own Books or Invoice organisation (SBC's receivables).
  Setting an organisation to the firm on the Match screen runs discovery again.
- A person's decision (`match = 'manual'`) survives every later discovery.
- Disconnect revokes the refresh token at Zoho, then retires the row.
- Engagement GSTIN and PAN come from `compliance_subject_fields` (`gstin`, `pan`); receivable
  clients from `receivable_clients.gstin`.

## Sync from Zoho (receivables)

```
 Sheet tab caret ─► Use Zoho Books… (firm-wide admin picks the Books org) ─► source = zoho
 [Sync from Zoho] ─► Invoices or Payments, period ─► integration_sync_jobs (module receivables)
      ▼  job reads Books, maps, stages as the person who pressed Sync
 Awaiting approval panel (same as Tally) ─► approve ─► invoices / markReceived
```

- Anyone who may edit the sheet presses Sync; only firm-wide admins choose Zoho and the org.
- An approved Zoho invoice is saved with invoice source `tally` (the "books" source), so the
  existing "Fix in Tally" and SAME rules apply unchanged.
- Use Tally instead switches back; Excel import works for every source.

## Owner setup

| # | Step |
|---|---|
| 0 | Apply migration `0071_integrations_zoho` on RDS before deploying the build that holds it (additive). |
| 1 | Zoho API console (api-console.zoho.com, signed in as a Zoho admin): add a Server-based Application. Redirect URIs: `https://app.sbctrack.in/api/integrations/zoho/callback` and `http://localhost:3000/api/integrations/zoho/callback`. In Settings, turn on Multi-DC so a sign-in on zoho.in works. |
| 2 | Env: `ZOHO_CLIENT_ID` (plain, App Runner env). Secret: `ZOHO_CLIENT_SECRET` locally; on AWS create Secrets Manager secret `vcfo/zoho-client-secret` and set `ZOHO_CLIENT_SECRET_SECRET_ID` to its name or ARN. |
| 3 | Optional: `ZOHO_APPS=books,crm` narrows the consent when Zoho refuses a scope for a product the account lacks; `ZOHO_FIRM_ORG_ID` / `ZOHO_FIRM_GSTIN` pin SBC's own Books organisation (otherwise matched by the firm name in Firm settings). |
| 4 | The person who connects must be a Zoho admin of every organisation. |

## Limits

- Payroll exists only on the com, in, ae and sa datacenters; elsewhere it shows "Not used".
- People has no organisation list: an account is one org, mapped by hand.
- CRM GSTIN or PAN is read only when Accounts has a field whose API name mentions GST, PAN or tax.
- Books customer payments have no date filter: they are read newest first and stop at the period
  start; each payment costs one more call for its applied invoices.
- The field check reads one sample record; "?" means the read failed or there was nothing to read.
