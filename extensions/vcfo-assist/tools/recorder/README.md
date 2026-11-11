# VCFO portal recorder

The recorder captures a government portal flow that a person walks through by hand: each page's
structure (fields, labels, buttons), the user's clicks and changes, and optionally a masked
screenshot. Claude builds a portal pack and a task recipe from it and checks the recipe offline
(`tools/offline/`). How to make a capture, step by step, is in
`docs/specs/vcfo-assist-agents/PORTAL-CAPTURE.md`; where that guide and this README differ, this
README is the final word on what the recorder does.

Ported from `abdulfarhath7/vcfo_assist` at `5e58bcf` (`capture/recorder.js`), with the stricter
rules below. The old recorder's stealth settings, script blocking, network bodies and eval control
file were dropped.

## Run it

```bash
cd extensions/vcfo-assist
CHROME_PATH=/path/to/chromium node tools/recorder/recorder.mjs https://www.mca.gov.in/ [options]
```

Playwright comes from the Suite repository's `node_modules`. Close the browser window (or press
Ctrl+C) to stop.

| Option | Effect |
|---|---|
| `--out DIR` | Where captures go. Default `~/vcfo-captures` (or `VCFO_CAPTURES_DIR`). A folder inside any git repository is refused. |
| `--network` | Also write `network.jsonl`: method, path without query, status and content type only. Off by default. |
| `--dummy-client` | The capture is of the firm's own or a dummy entity: do not mask PAN, Aadhaar, DIN, email and phone shaped text in saved pages. Field values are still never stored. |
| `--no-screenshots` | Take no screenshots at all. |
| `--keep-profile` | Keep the browser profile after the run. Default: deleted, because it holds the logged-in session. |

## What it writes

Under `<out>/steps/<run id>/`:

| File | What it holds |
|---|---|
| `NNNN/page.html`, `frame-N.html` | The page's DOM, with every `value` attribute, textarea text, `selected` and `checked` flag, inline script body, secret meta tag and query string removed; PAN, Aadhaar, DIN, email and phone shaped text masked (`[PAN]`, `[AADHAAR]`, `[DIN]`, `[EMAIL]`, `[PHONE]`) unless `--dummy-client`. |
| `NNNN/elements.json` | Every control: tag, type, id, name, MCA key (the `.guideFieldNode` class), label, placeholder, button text, `filled: yes/no`, required, visible, CSS path, option lists (masked like text). Never a value. Secret-looking controls are marked `secret`. |
| `NNNN/screenshot.png` | Only when the page shows no captcha image, canvas, password or OTP box. Every form control is blacked out. Page text can still show client details: review it, or use `--no-screenshots`. |
| `NNNN/meta.json` | URL without its query, title, headings, element count, why the screenshot was taken or skipped. |
| `events.jsonl` | Clicks (button text), changes (`filled: yes/no`, never what was typed), Enter and Tab, navigations (no query). |
| `network.jsonl` | Only with `--network`: method, path, status, content type. No headers, cookies, `Set-Cookie`, `Authorization`, tokens or bodies, ever. |
| `RUN.json`, `recorder.log` | The options used and the run log. |

The browser profile is a sibling folder `.profile-<run id>` and is deleted when the run ends,
unless `--keep-profile`.

## Rules (not settings)

1. **Nothing is hidden and no portal control is defeated.** The recorder opens an ordinary visible
   Chromium. It does not hide the automation flag, does not change `navigator.webdriver`, does not
   block, patch or skip any script the portal loads (including anti-devtools or anti-bot scripts),
   and uses no stealth plugin. If the portal refuses this browser (for example it sends a form page
   straight back to its home page with no click), the recorder stops and says so. Then capture the
   flow another way, as `PORTAL-CAPTURE.md` describes, or ask the owner.
   `src/recorder/recorder.test.ts` fails if any such code appears.
2. **No values.** No field value, typed or selected, is stored anywhere.
3. **No secrets.** No cookie, session, token, CSRF or authorization data, in any file.
4. **No captcha, password or OTP screenshots.**
5. **Outside the repository.** Captures and the profile never go into git. The package's
   `.gitignore` also ignores `captures/`, `tools/recorder/steps/`, `tools/recorder/profile/` and
   `*.har`, in case one is copied in by hand.
6. **The person logs in.** The recorder never types a login, captcha or OTP; the person does, in
   the recorder's window, with their own login.

## After the run

Check the run folder against the list in `PORTAL-CAPTURE.md` before sending it. To check a recipe
against it offline, put the run folder under `extensions/vcfo-assist/captures/` (git-ignored) or
point `VCFO_CAPTURES_DIR` at it, then run `npm test` (jsdom) or `npm run offline` (Chromium); see
`tools/offline/README.md`.
