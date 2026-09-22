# MCA Recorder (internal tool)

Passive Chrome extension that records the *structure* of an MCA V3 session
(SPICe+, AGILE-PRO-S, INC-9, DIR-2, etc.) while a human operator files it.
Output feeds the vCFO assist extension's field map and step model.

What it captures on every `*.mca.gov.in` page (top frame and iframes):

- page snapshots: URL, title, headings, wizard steps, buttons, error banners,
  and every field (tag, type, id, name, CSS path, label, placeholder,
  required, maxLength, pattern, data-* attrs, dropdown options)
- interaction sequence: `change` (field + redacted value shape), `click`
  (button/tab text + path), `submit`, route changes, unloads
- network shapes: method, URL with query *keys* only, status. No bodies.

What it never stores: raw field values (only `<12 upperalnum>` style shapes),
password fields, request/response bodies, cookies, DSC/emBridge traffic
(that is a native app, outside the browser).

## Load

1. `chrome://extensions` → Developer mode on → Load unpacked → pick
   `tools/mca-recorder/`.
2. Operator logs in and files as usual. Recording is automatic.
3. Click the extension icon → **Export JSON**. Save into
   `docs/mca-recordings/` (gitignored — may still contain company names in
   dropdown option text, review before sharing).
4. **Clear recording** before the next client.

Export can be several MB for a full SPICe+ run; that is expected.
