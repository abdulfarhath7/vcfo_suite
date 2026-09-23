# 06 — Why this route needs no CORS and no token

A note so nobody "fixes" this later by loosening something.

## The extension does not call this route from the extension

VCFO Assist loads the profile by running a fetch **inside an already-open VCFO Suite
tab**, using `chrome.scripting.executeScript`. The request therefore originates from
`app.sbctrack.in` itself.

Consequences:

- **Same-origin.** No CORS preflight, no `Access-Control-Allow-Origin`, no
  `Access-Control-Allow-Credentials`.
- **The Auth.js session cookie is sent normally.** It is `SameSite=Lax`, which would
  have dropped it on a cross-site request from `chrome-extension://…`, but this is not
  a cross-site request.
- **No second credential is needed.** No bearer token, no connection code, no
  engagement-scoped token route.

## What this means for the build

Build the route as an ordinary staff-scoped Suite route. Session cookie only. Do not
add:

- `Access-Control-*` headers of any kind
- An `OPTIONS` handler
- An env var listing extension origins
- A token-issuing route
- Any change to the session cookie's `SameSite` attribute

If a future change makes the extension call this route directly, the correct fix is to
put the call back inside a Suite tab — not to relax the cookie.

## Local development

The extension will be pointed at `http://localhost:3000` during development. Same
reasoning applies: the fetch runs inside the localhost tab, so it is same-origin there
too.
