# VCFO Tally Connector

A small Windows program that runs on the office PC next to TallyPrime. It waits for a sync
job from VCFO, reads the requested sales or receipt vouchers from TallyPrime's local XML
server, turns them into JSON and uploads them to VCFO. T1 covers one client (Summit).

It is a console program with a log file. It has no installer, no tray icon and no
auto-update yet.

## Safety

- **Read-only to Tally.** The connector only sends Export requests. Every request passes a
  write guard (`src/guard.ts`) that refuses any XML whose `TALLYREQUEST` is not `Export`, or
  that carries import data or a create, alter or delete action. Tests cover the guard.
- **Outbound only.** The connector opens no port. It calls VCFO over HTTPS and calls Tally on
  `127.0.0.1` only. Nothing on the internet can reach the PC through it.
- **Revocable token.** Pairing stores one token in
  `%APPDATA%\VCFO Tally Connector\config.json`. Revoking the connection in VCFO makes the
  next call fail with 401, and the connector stops with "Disconnected from VCFO. Pair again."
- **No values in logs.** The log records counts, dates and job ids only, never the token,
  party names or amounts.
- **Idle cost is near zero.** One long-poll request is open at a time (VCFO holds it up to
  45 s). There are no timers and no busy loops. After a network error the connector waits
  5 s, then 15 s, then 60 s between attempts.

## Setup for Summit's accountant

1. **Turn on TallyPrime's server.** In TallyPrime press F1 (Help) > Settings > Connectivity >
   Client/Server configuration. Set "TallyPrime acts as" to **Both** (or Server), "Enable
   ODBC" to **Yes** and the port to **9000**. Restart TallyPrime and open Summit's company.
2. **Copy the program.** Put `vcfo-tally-connector.exe` in a fixed folder, for example
   `C:\VCFO\vcfo-tally-connector.exe`.
3. **Check Tally.** Open Command Prompt in that folder and run:
   ```
   vcfo-tally-connector.exe test
   ```
   It should print the open company's name.
4. **Pair.** In VCFO open the receivables sheet, choose **Connect Tally** and copy the code.
   Then run:
   ```
   vcfo-tally-connector.exe pair ABCD-1234
   ```
   Add `--url https://...` only if VCFO tells you to, and `--tally-port 9001` only if Tally
   uses a port other than 9000.
5. **Start it at Windows login.** Press Win+R, type `shell:startup` and press Enter. In the
   folder that opens, right-click > New > Shortcut, browse to `C:\VCFO\vcfo-tally-connector.exe`
   and name it "VCFO Tally Connector". With no arguments the program runs the sync loop once
   it is paired. Set the shortcut's "Run" to **Minimized** (right-click > Properties) so the
   window stays out of the way. Double-click the shortcut once to start it now.

The connector only works while TallyPrime is open with the company loaded. If Tally is
closed when a job arrives, VCFO receives a clear error and can retry later.

## Commands

| Command | What it does |
|---|---|
| `pair <CODE> [--url https://app.sbctrack.in] [--tally-port 9000]` | Pairs this PC with VCFO and saves the token. |
| `run` | Waits for sync jobs. This is the default when the program is started with no arguments after pairing. |
| `status` | Shows the config and log paths, the VCFO address, the paired sheet and whether Tally answers. |
| `test [--tally-port 9000]` | Checks that TallyPrime answers and prints the open company. |

Files live in `%APPDATA%\VCFO Tally Connector\`: `config.json` and `connector.log` (rotated at
1 MB, three files kept). On Linux and macOS, for development, the folder is
`~/.config/vcfo-tally-connector`; `VCFO_TALLY_CONFIG_DIR` overrides it.

## Troubleshooting

| Message or symptom | What to do |
|---|---|
| "TallyPrime is not open, or its server is off" | Open TallyPrime and the company. Check F1 > Settings > Connectivity: server on, port 9000. Run `test`. |
| "TallyPrime answered with HTTP 400" | Something other than Tally is using the port. Change Tally's port and pair or test with `--tally-port`. |
| "TallyPrime refused the request: Could not find Company" | Load Summit's company in TallyPrime. |
| "TallyPrime did not answer in time" | Tally is busy (a report or a backup is running). The job reports an error; VCFO can retry. |
| "Disconnected from VCFO. Pair again." | The token was revoked or expired. Get a new code from VCFO and run `pair` again. |
| "network problem talking to VCFO … retrying" | The internet or a proxy is down. The connector retries by itself (5 s, 15 s, 60 s). |
| Windows says the publisher is unknown | The exe is not code-signed yet (see Limits). Choose "More info" > "Run anyway". |
| Anything else | Send `%APPDATA%\VCFO Tally Connector\connector.log`. It has no token or amounts in it. |

## How it reads Tally

For each job the connector splits the period into calendar months and sends one Export
request per month: a TDL collection of `Voucher` filtered with `$$IsSales:$VoucherTypeName`
(sales) or `$$IsReceipt:$VoucherTypeName` (receipts), so custom voucher types under those
parents are included. `SVFROMDATE`/`SVTODATE` (YYYYMMDD) set the period. It fetches the GUID,
type, number, date, party ledger, party GSTIN, amount, the cancelled and optional flags, and
the ledger entries with their bill allocations.

Mapping: cancelled and optional vouchers are skipped. The amount is the party ledger entry's
amount as a positive number (the voucher amount if no party entry is found). The bills are the
party entry's bill allocations, as positive amounts. Vouchers are de-duplicated by GUID, and
dates outside the month are dropped. Invalid XML characters that Tally emits (`&#4;` and
similar) are removed before parsing. UTF-16 responses are handled.

The company name comes from a `Company` collection with a computed `$Name = ##SVCurrentCompany`
flag; if no company is flagged the first loaded company is used.

## The VCFO contract (fixed)

All calls after pairing send `Authorization: Bearer <token>`. A 401 stops the connector.

| Call | Body | Answer |
|---|---|---|
| `POST /api/tally/connector/pair` | `{code, name, version, tallyCompany}` | `200 {token, sheetName}` |
| `POST /api/tally/connector/hello` | `{version, tallyCompany, tallyReachable}`, at start and every 10 min | 2xx |
| `GET /api/tally/connector/jobs` | long poll, held up to 45 s | `204` no job, or `200 {job:{id, type:'sales'\|'receipts', from, to}}` |
| `POST /api/tally/connector/jobs/:id/result` | gzip JSON, at most 20 MB: `{ok:false, error}` or `{ok:true, company, vouchers}` | 2xx |

`Voucher = {guid, voucherType, voucherNo, date:'YYYY-MM-DD', partyName, gstin: string|null,
amount: number (positive INR), bills?: [{name, amount}]}`.

## Development

```bash
cd tools/tally-connector
npm install
npm test            # vitest: mapping, write guard, month splitting, backoff
npx tsc --noEmit
npm run build       # dist/connector.cjs (one bundled file, runs with node 20+)
node dist/connector.cjs status
```

The folder has its own `package.json` and is not part of the VCFO app's workspace. Its one
runtime dependency is `fast-xml-parser`; there are no native modules.

## Building the Windows .exe

`npm run build:exe` runs `scripts/build-exe.mjs`, which:

1. bundles `src/cli.ts` with esbuild into `dist/connector.cjs`;
2. writes `dist/sea-config.json` and runs `node --experimental-sea-config` to make
   `dist/sea-prep.blob`;
3. copies a Node binary to `dist/vcfo-tally-connector.exe`;
4. injects the blob with `postject` (sentinel `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`).

On Windows it uses the running `node.exe` and removes the old signature with `signtool` if the
Windows SDK is installed. On Linux or macOS, download the Windows `node.exe` of **the same
version** as your local Node and point `NODE_WIN_EXE` at it:

```bash
v=$(node -v)
curl -fLo /tmp/node.exe https://nodejs.org/dist/$v/win-x64/node.exe
NODE_WIN_EXE=/tmp/node.exe npm run build:exe   # -> dist/vcfo-tally-connector.exe
```

Without `NODE_WIN_EXE` on Linux or macOS the script builds a binary for the current platform,
as a smoke test. That needs a real `node` binary; version-manager shims cannot be used.

## Limits (T1)

- Tested against fixture XML written to look like TallyPrime output, and end to end against a
  mock Tally and a mock VCFO server. Not yet tested against a live TallyPrime. The company
  `COMPUTE` flag and the invoice-mode ledger entries should be checked on Summit's PC first.
- The exe is not code-signed. Injection breaks Node's own signature, so SmartScreen may warn.
- Console window only: no tray icon, no auto-update, no Windows service.
- One Tally company per connector, the one open in TallyPrime.
