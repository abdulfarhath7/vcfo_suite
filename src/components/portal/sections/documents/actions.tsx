'use client';

/**
 * CONTRACT (used by Home's dock, the walkthroughs and Search — keep the signature):
 *   useDocActions() → { focusUpload(opts?) }  scroll to Documents and open / highlight the upload for one open
 *   request (opts.requestId) or for a step (opts.stepId); with no opts, the "Still needed from you" strip.
 *
 * The Documents section draws one upload card per open request as `#up-<requestId>` with
 * `data-step="<stepId>"` (prototype focusUpload: go('documents') then flash `#up-<hold>`).
 */
import { useCallback, useMemo } from 'react';
import { usePortal } from '../../runtime';

export interface DocActions {
  focusUpload: (opts?: { requestId?: string; stepId?: string }) => void;
}

export const UPLOAD_STRIP_ID = 'upc';
export const uploadCardId = (requestId: string): string => `up-${requestId}`;

/** Re-run the prototype's `flash` animation on an element. */
export function flash(el: Element | null | undefined) {
  if (!el) return;
  el.classList.remove('flash');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('flash');
}

export function useDocActions(): DocActions {
  const { go } = usePortal();
  const focusUpload = useCallback(
    (opts?: { requestId?: string; stepId?: string }) => {
      const find = (): Element | null => {
        if (opts?.requestId) return document.getElementById(uploadCardId(opts.requestId));
        if (opts?.stepId) return document.querySelector(`#${UPLOAD_STRIP_ID} [data-step="${CSS.escape(opts.stepId)}"]`);
        return document.getElementById(UPLOAD_STRIP_ID);
      };
      const target = find();
      // land on the card itself when it exists, else on the section
      if (target && target.id) go('documents', { target: target.id });
      else go('documents');
      window.setTimeout(() => flash(find() ?? document.getElementById(UPLOAD_STRIP_ID)), 700);
    },
    [go],
  );
  return useMemo(() => ({ focusUpload }), [focusUpload]);
}
