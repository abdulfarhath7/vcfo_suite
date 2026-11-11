import type { AssistProfile } from '@/lib/assist-profile/types';
import type { AssistDscSigner, AssistSignerKind } from './types';

/**
 * WHO SIGNED (SAFETY.md G14, evidence log). At the DSC step the side panel asks "Who signed?" and
 * the user picks from the engagement's directors and subscribers (from the Assist profile) or
 * "me, the certifying professional". The extension sends references only, never a name, so no
 * profile value travels back to Suite; Suite turns each reference into a name from its own
 * records here.
 *
 *   director:<entry id>     a proposed director (`directors[].id`, for example `e3` or `legacy-1`)
 *   subscriber:<n>          the subscriber at 1-based position n (`subscribers[].index`)
 *   professional:self       the signed-in Suite user (the certifying professional)
 *
 * Returns null when any reference does not resolve, so the route answers `unknown_signer`.
 */

const personName = (p: { firstName?: string; middleName?: string; surName?: string } | undefined): string =>
  [p?.firstName, p?.middleName, p?.surName].filter((s) => s && s.trim()).join(' ').trim();

export function resolveDscSigners(profile: Pick<AssistProfile, 'directors' | 'subscribers'>, refs: readonly string[], self: { name: string; email?: string }): AssistDscSigner[] | null {
  const out: AssistDscSigner[] = [];
  for (const ref of [...new Set(refs)]) {
    const [kind, id] = ref.split(':') as [AssistSignerKind, string];
    let name = '';
    if (kind === 'director') name = personName(profile.directors.find((d) => d.id === id));
    else if (kind === 'subscriber') {
      const sub = profile.subscribers.find((s) => String(s.index) === id);
      name = sub ? (sub.kind === 'bodyCorporate' ? personName(sub.representative) || sub.name?.trim() || '' : personName(sub)) : '';
    } else if (kind === 'professional' && id === 'self') name = self.name?.trim() || self.email || '';
    if (!name) return null;
    out.push({ ref, kind, name });
  }
  return out;
}
