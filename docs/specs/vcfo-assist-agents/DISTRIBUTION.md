# VCFO Assist — distribution and release

This file says how the VCFO Assist Chrome extension reaches staff browsers, how a release is made,
and how it is stopped. It is guard G18 in `SAFETY.md`. It answers risk 6 and checklist item 8 of the
legal review (`docs/specs/mca-connect/reports/VCFO Assist legal review.md`): in December 2024 an
attacker phished the Chrome Web Store publisher account of Cyberhaven and pushed a malicious update
to its extension, and at least 29 other extensions were hit the same way. Chrome installs an
update without asking the user. Signed recipes (G15) do not help here, because the attacker
replaces the code that checks the signatures.

None of this is set up yet. The steps below are what must be true **before the first live filing**.

## 1. Force-install through Chrome enterprise policy, not the public Web Store

- The extension is **not listed on the public Chrome Web Store**, not even as unlisted. A store
  listing means a store publisher account that can be phished.
- Staff Chrome profiles are managed (Google Workspace or Chrome Browser Cloud Management, or a
  Windows or macOS policy file pushed by the firm's device management). The extension is installed
  for a named staff group only, with `ExtensionSettings`:

```json
{
  "ExtensionSettings": {
    "<extension id>": {
      "installation_mode": "force_installed",
      "update_url": "https://<firm update host>/extensions/vcfo-assist/updates.xml",
      "override_update_url": true,
      "toolbar_pin": "force_pinned"
    },
    "*": { "installation_mode": "allowed" }
  }
}
```

  `ExtensionInstallForcelist` (`<extension id>;<update URL>`) does the same on older consoles.
  `override_update_url: true` makes Chrome take updates only from the pinned URL, whatever the
  manifest says. Clients never install it; it is a staff tool.
- The **extension id** is pinned by the manifest `key`: the public half of the release signing key,
  base64 DER. `wxt.config.ts` reads it from `VCFO_ASSIST_MANIFEST_KEY` at release time only, and
  no key is committed (`src/manifest.test.ts` fails if key material appears in the config).
- The **update URL** in the manifest comes from `VCFO_ASSIST_UPDATE_URL` at release time. The
  committed default, `https://app.sbctrack.in/extensions/vcfo-assist/updates.xml`, is a
  **placeholder**: no such file is served yet. The host that serves `updates.xml` and the `.crx`
  must be the firm's own (an S3 bucket behind HTTPS, for example), with write access limited to the
  release role. `src/manifest.test.ts` fails if the update URL is not HTTPS or points at Google's
  store.

## 2. Keys and accounts

- The **CRX signing key** (the private key whose public half is the manifest `key`) is kept in a
  hardware-backed store (a hardware security key or a cloud KMS key that cannot be exported), never
  on a laptop disk or in the repository.
- Every account that can publish, sign, or change the update host has **hardware-key MFA**
  (FIDO2 or WebAuthn security keys, not SMS or app codes): the Google account for the policy
  console, the AWS role that writes the update bucket, and GitHub accounts with write access to the
  repository.
- Recipe signing (`ASSIST_RECIPE_PRIVATE_KEY`, G15) is a separate key in Suite's secrets. It never
  signs an extension build.

## 3. Two-person release

1. A developer opens a pull request with the version bump in `extensions/vcfo-assist/package.json`.
2. A **second person** reviews and approves it. The branch protection on `main` requires one
   approving review from someone other than the author, and passing CI.
3. CI (below) builds the extension from the merged commit.
4. The release person signs the `.crx` with the hardware-held key and uploads it with a new
   `updates.xml`. A second person checks the uploaded file's SHA-256 against the CI build before the
   new `updates.xml` is made live. Nobody can do both steps alone.
5. When the new version is out, raise `ASSIST_MIN_EXTENSION_VERSION` in Suite if older builds must
   stop (for example after a security fix).

## 4. Dependency lock in CI

- `extensions/vcfo-assist/package-lock.json` is committed, and CI installs with `npm ci` (never
  `npm install`), so the build uses exactly the reviewed dependency tree. `src/manifest.test.ts`
  fails without a lockfile, and fails on a captcha-solver, OTP-reading or automation-cloud package.
- CI runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and `npm run e2e` in
  `extensions/vcfo-assist`. A change to the lockfile needs the same second-person review as code.
- `npm audit --omit=dev` runs in CI; a high or critical advisory blocks the release.

## 5. The kill switch

Suite's `GET /api/assist/catalog` carries two fields, read by the extension at **every run start**,
before it reads the recipe or the client's profile (`src/engine/kill.ts`):

| Field | Set by | Effect |
|---|---|---|
| `extensionDisabled` | `ASSIST_EXTENSION_DISABLED=true` on App Runner | Every run stops at the start with "VCFO Assist is switched off in VCFO Suite". |
| `minExtensionVersion` | `ASSIST_MIN_EXTENSION_VERSION=0.2.0` (dotted numbers) | A build below it stops with "This extension is older than the version Suite requires". |

- A catalog that cannot be read also stops the run (fail closed), with "Try again".
- To stop all filing at once after a suspected compromise: set `ASSIST_EXTENSION_DISABLED=true` in
  the App Runner service's environment and redeploy the configuration. Then remove the extension
  from the policy's force-install list, which uninstalls it from every managed browser.
- The switch stops only new runs. A run already past its start keeps going until its next human
  gate; the user can cancel it from the panel.

## 6. What the extension may ask for

The permission list stays `sidePanel`, `scripting` and `storage`, plus the Suite, mock and MCA
hosts (`wxt.config.ts`). `src/manifest.test.ts` fails the build if another permission or host
appears, so a release that quietly widens the extension's reach cannot pass CI.
