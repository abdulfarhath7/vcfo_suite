'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getIncorporationPhases } from '@/data/checklist';
import { ASK_FOCUS_PARAM, ASK_FROM_PARAM, ASK_FROM_VALUE, stripAskParams } from '@/lib/ask/resolve-href';

/** A step id the page does not show on its own maps to its phase row. */
export function focusCandidates(focus: string): string[] {
  const phase = getIncorporationPhases().find((p) => p.itemIds.includes(focus));
  return phase ? [focus, phase.id] : [focus];
}

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.getAttribute('data-reduce-motion') === 'true' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Arrival from an Ask VCFO link (`?from=ask&focus=<id>`): scroll the matching
 * `[data-ask-focus]` element into view, pulse it once (a focus ring under
 * reduced motion), then drop the params with `router.replace` so a refresh
 * does not re-pulse. Mounted once with the panel, so every page that marks
 * its rows with `data-ask-focus` gets it.
 */
export function useAskFocus(): void {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const from = params?.get(ASK_FROM_PARAM);
  const focus = params?.get(ASK_FOCUS_PARAM) ?? '';

  useEffect(() => {
    if (from !== ASK_FROM_VALUE) return;
    let cancelled = false;
    let attempts = 0;
    const clean = () => router.replace(`${pathname}${stripAskParams(window.location.search)}`, { scroll: false });
    const tryFocus = () => {
      if (cancelled) return;
      const el = focus
        ? focusCandidates(focus)
            .map((id) => document.querySelector<HTMLElement>(`[data-ask-focus="${CSS.escape(id)}"]`))
            .find(Boolean)
        : null;
      // Up to ~9 s: a cold page loads its project data before the rows exist.
      if (!el && focus && attempts < 60) {
        // Pages render their rows after data loads; look again shortly.
        attempts += 1;
        window.setTimeout(tryFocus, 150);
        return;
      }
      if (el) {
        const reduce = prefersReducedMotion();
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        const cls = reduce ? 'ask-focus-ring' : 'ask-focus-pulse';
        el.classList.add(cls);
        window.setTimeout(() => el.classList.remove(cls), reduce ? 2500 : 1700);
      }
      clean();
    };
    tryFocus();
    return () => {
      cancelled = true;
    };
  }, [from, focus, pathname, router]);
}
