# Offline recipe check

Checks that every VCFO Suite MCA recipe still binds to a captured page, without the portal,
without Suite and without the extension. Ported from `abdulfarhath7/vcfo_assist` at `5e58bcf`
(`tools/test_filler.js`).

The in-page code is the extension's own scanner, heal ladder (T0 and T1 only, no AI), guards and
filler (`src/offline/offline-fill.ts`). It fills the sample client in `sample-profile.json`
(sentinel values) and reports each field: `filled` (with its tier), `missing`, `user`,
`noinstance` (another person's Add/Edit block is not open), `hidden`, `refused`, `notfound` or
`failed`. It never clicks a button.

## Pages it runs on

- `fixtures/*.html`: sanitized fixtures, committed. `build-fixtures.mjs` rebuilds them from the
  captured schemas in `portal-data/mca-v3/schemas/` with the real AEM node ids, widget ids, names,
  labels, option lists and hidden system fields, and no value of any kind. Rebuild with
  `npm run mocks`.
- Real captures, never committed: put a recorder run folder (or saved `*.html` pages carrying
  `<meta name="vcfo-capture-url" content="https://www.mca.gov.in/...">`) under
  `extensions/vcfo-assist/captures/`, or set `VCFO_CAPTURES_DIR`. The folder is git-ignored.

## Run it

```bash
npm test                                       # jsdom: src/offline/offline.test.ts (fixtures, plus local captures if present)
CHROME_PATH=/path/to/chromium npm run offline  # real Chromium: tools/offline/run-offline.mjs
```

The Chromium run serves each page under its real URL with every script removed and answers every
other request locally with nothing, so no portal endpoint is ever called. It fails if a field
fails, if nothing fills on a fixture, or if any button is clicked.
