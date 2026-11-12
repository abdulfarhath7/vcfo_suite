import { toastSaved } from '@/components/ui/toast-saved';
import { toastUndo } from '@/components/ui/undo-toast';
import type { ToastOptions } from './PortalProvider';

/**
 * The client portal's `toast()` (GL-02). It goes through the app's one `react-hot-toast`
 * Toaster, so the portal has the same toast as staff: 3 seconds, or 6 with an Undo or an
 * action; three at most, the newest on top; a close X; the timer stops under the pointer.
 * A `kind` gives the white A1 toast with a status tile, otherwise the dark A2 line. Both follow
 * the portal's own theme. After an Undo a short "Undone" toast confirms it, as before.
 */
export function showPortalToast(msg: string, opts: ToastOptions = {}, theme?: 'light' | 'dark'): string {
  const undo = opts.undo
    ? () => {
        opts.undo?.();
        toastUndo('Undone', undefined, { theme });
      }
    : undefined;
  if (opts.kind) return toastSaved(msg, { kind: opts.kind, sub: opts.sub, onUndo: undo, action: opts.action, theme });
  return toastUndo(msg, undo, { action: opts.action, theme });
}
