import { defineConfig } from 'wxt';

/**
 * WXT build for VCFO Assist Agents.
 *
 * The permission list is deliberately short (SAFETY.md, "Supporting controls"): sidePanel,
 * scripting and storage, plus host access for the Suite origins, the local mock portal and the
 * MCA portal. `src/manifest.test.ts` fails if another permission or host appears.
 */
export const PERMISSIONS = ['sidePanel', 'scripting', 'storage'];
export const HOST_PERMISSIONS = [
  'http://localhost/*',
  'http://127.0.0.1/*',
  'https://app.sbctrack.in/*',
  'https://*.mca.gov.in/*',
];

/**
 * Distribution (SAFETY.md G18, docs/specs/vcfo-assist-agents/DISTRIBUTION.md). The extension is
 * force-installed by Chrome enterprise policy, never published on the public Web Store, and updates
 * only from the firm's own pinned update manifest. The URL below is a PLACEHOLDER until the owner
 * sets up the update host; a release build sets `VCFO_ASSIST_UPDATE_URL`. The enterprise policy
 * pins the same URL (`ExtensionSettings.<id>.update_url` with `override_update_url: true`), so a
 * hijacked store listing cannot push an update.
 */
export const UPDATE_URL = process.env.VCFO_ASSIST_UPDATE_URL || 'https://app.sbctrack.in/extensions/vcfo-assist/updates.xml';

/**
 * `key` pins the extension id. It is the PUBLIC half of the release signing key (base64 DER),
 * set from `VCFO_ASSIST_MANIFEST_KEY` at release time only. No key is committed here; the private
 * signing key lives on a hardware-backed store under two-person control (DISTRIBUTION.md).
 */
const MANIFEST_KEY = process.env.VCFO_ASSIST_MANIFEST_KEY?.trim() || undefined;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: {
    name: 'VCFO Assist Agents',
    description:
      'Fills government portal forms from VCFO Suite data. Stops at login, DSC, Submit and Pay, which the user does.',
    permissions: PERMISSIONS,
    host_permissions: HOST_PERMISSIONS,
    action: { default_title: 'Open VCFO Assist' },
    update_url: UPDATE_URL,
    ...(MANIFEST_KEY ? { key: MANIFEST_KEY } : {}),
  },
});
