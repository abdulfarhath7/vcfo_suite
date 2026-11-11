/**
 * G18 — THE REMOTE KILL SWITCH (SAFETY.md; risk 6 in the legal review, the Cyberhaven update of
 * December 2024). At every run start the engine reads Suite's catalog and refuses to run when it
 * says `extensionDisabled: true`, or when this extension's version is below `minExtensionVersion`.
 * A catalog that cannot be read stops the run too (the user can retry): the switch fails closed.
 */
import type { Catalog } from '../shared/types';

/** -1, 0 or 1 for dotted numeric versions (`0.2.0` < `0.10.0`); a missing part counts as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export const DISABLED_MESSAGE = 'VCFO Assist is switched off in VCFO Suite. Ask the firm admin before filing.';

/** Null when the run may start; otherwise the message the panel shows. */
export function killSwitchReason(catalog: Catalog | null, extensionVersion: string): string | null {
  if (!catalog) return 'Could not read the VCFO Assist switch from Suite, so the run did not start. Check the Suite tab and try again.';
  if (catalog.extensionDisabled) return DISABLED_MESSAGE;
  if (catalog.minExtensionVersion && compareVersions(extensionVersion, catalog.minExtensionVersion) < 0) {
    return `This extension (${extensionVersion}) is older than the version Suite requires (${catalog.minExtensionVersion}). Update it before filing.`;
  }
  return null;
}
