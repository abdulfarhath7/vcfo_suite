'use client';

import { use, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { toastSaved } from '@/components/ui/toast-saved';
import { AppContext } from '@/context/app-context-store';
import type { AppNotification } from '@/lib/checklist/checklist-notifications';

/**
 * GL-06 / PR-02: a background export tells the person in the bell when its file is ready. While
 * the page that started it is still open, this also shows a toast with a Download button. The
 * notice body starts with the file name (`exportInBackground`), which is how the two are matched.
 *
 * The exports waiting for a notice are kept for the page, not for one button, so an export
 * started from a menu item that has since closed still gets its toast from any export control on
 * the same page. Outside the app provider (a unit test) it does nothing.
 */
const pending = new Map<string, { since: number; path: string }>();

export function useExportReadyToast() {
  const app = use(AppContext);
  const notifications = app?.notifications;

  useEffect(() => {
    if (!notifications?.length || pending.size === 0) return;
    for (const [fileName, { since, path }] of pending) {
      const hit = exportNoticeFor(notifications, fileName, since);
      if (!hit) continue;
      pending.delete(fileName);
      // Only on the page that started it; elsewhere the bell is enough.
      if (window.location.pathname !== path) continue;
      if (hit.ready) {
        toastSaved(hit.notice.title, {
          sub: fileName,
          action: { label: 'Download', onClick: () => window.location.assign(hit.notice.href) },
          duration: 6000,
          id: `export:${fileName}`,
        });
      } else {
        toast.error(hit.notice.title, { id: `export:${fileName}` });
      }
    }
  }, [notifications]);

  /** Start watching for the notice of an export that was just queued. */
  return useCallback((fileName: string) => {
    // A minute of slack covers a browser clock that differs from the server's.
    pending.set(fileName, { since: Date.now() - 60_000, path: window.location.pathname });
  }, []);
}

/** The bell notice of one background export, once it has arrived: ready, or did not finish. */
export function exportNoticeFor(
  notifications: readonly AppNotification[],
  fileName: string,
  since: number,
): { notice: AppNotification; ready: boolean } | null {
  for (const n of notifications) {
    if (!n.body.startsWith(fileName)) continue;
    const at = Date.parse(n.createdAt);
    if (!Number.isNaN(at) && at < since) continue;
    return { notice: n, ready: n.href.startsWith('/api/exports/') };
  }
  return null;
}
