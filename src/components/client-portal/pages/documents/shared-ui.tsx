'use client';

/**
 * Pieces shared by the Documents explorer (desktop/tablet), the phone board,
 * the drill-down, the upload flow and the Library pages. There is no bot
 * figure (R-04): empty states are plain-edged areas with the action (R-48).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOAST_ERROR_MS, TOAST_MS } from '@/components/ui/hot-toast';
import { usePortalOptional } from '@/components/client-portal/PortalProvider';
import type { ClientDocumentsPayload, DocNode } from '@/lib/client-portal/documents';
import type { ViewerDoc } from './DocViewer';
import { engagementParam, fileUrl } from './model';
import { triggerDownload } from './file-types';

export const DOCS_KEY = ['client-portal', 'documents'] as const;

async function fetchClientDocuments(engagementId?: string): Promise<ClientDocumentsPayload> {
  const qs = engagementId ? `?engagement=${encodeURIComponent(engagementId)}` : '';
  const res = await fetch(`/api/client/documents${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status === 404 ? 'none' : `documents ${res.status}`);
  return ((await res.json()) as { documents: ClientDocumentsPayload }).documents;
}

/** A client's own documents; staff pass the engagement they are viewing (and `enabled` false until they have one). */
export function useClientDocuments(engagementId?: string, enabled = true) {
  return useQuery({ queryKey: [...DOCS_KEY, engagementId ?? 'own'], queryFn: () => fetchClientDocuments(engagementId), enabled, staleTime: 15_000, retry: (n, e) => (e as Error).message !== 'none' && n < 2 });
}

/** DECISIONS "Loading L1": skeleton shown after 150 ms, held at least 300 ms. */
export function useDelayedLoading(loading: boolean): boolean {
  const [show, setShow] = useState(false);
  const since = useRef<number | null>(null);
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        since.current = Date.now();
        setShow(true);
      }, 150);
      return () => clearTimeout(t);
    }
    if (!show) return;
    const held = since.current ? Date.now() - since.current : 300;
    const t = setTimeout(() => setShow(false), Math.max(0, 300 - held));
    return () => clearTimeout(t);
  }, [loading, show]);
  return show;
}

/** Overlays render into the portal root so page CSS (scoped `.cp .cp-documents`) still applies. */
export function PagePortal({ children, page = 'documents' }: { children: ReactNode; page?: string }) {
  const [el, setEl] = useState<Element | null>(null);
  useEffect(() => setEl(document.querySelector('.cp') ?? document.body), []);
  if (!el) return null;
  return createPortal(<div className={`cp-${page}`}>{children}</div>, el);
}

/* ---------------- ZIP / copy toast ---------------- */

export interface ZipToastState {
  name: string;
  total: number;
  n: number;
  done: boolean;
  copy?: boolean;
  error?: string;
}

/** One id for the ZIP and copy toast, so its progress updates in place instead of stacking. */
export const ZIP_TOAST_ID = 'cp-zip';

/**
 * How long the ZIP toast stays (GL-02): open while the ZIP is built, then 3 seconds when it is
 * done or a link was copied, and 6 seconds for an error.
 */
export function zipToastDuration(t: ZipToastState): number {
  if (!t.done) return Infinity;
  return t.error ? TOAST_ERROR_MS : TOAST_MS;
}

/**
 * Real ZIP download: streams `/api/client/documents/zip?folder=` and maps the received bytes
 * onto an "n of total" files counter. The toast goes through the app's one `react-hot-toast`
 * Toaster (GL-02), so it has the shared timings, limit, close X and pause on hover.
 */
export function useZipToast() {
  const ctrl = useRef<AbortController | null>(null);
  const portal = usePortalOptional();
  // Staff see a portal page in their own shell and theme; only the client portal has its own.
  const theme = portal && !portal.engagementId ? portal.theme : undefined;
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const dismiss = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    toast.dismiss(ZIP_TOAST_ID);
  }, []);

  const show = useCallback(
    (t: ZipToastState) => {
      toast.custom((rt) => <ZipToast t={t} visible={rt.visible} theme={themeRef.current} onClose={dismiss} />, {
        id: ZIP_TOAST_ID,
        duration: zipToastDuration(t),
        position: 'bottom-left',
      });
    },
    [dismiss],
  );

  const startZip = useCallback(
    async (folder: string, name: string, total: number) => {
      ctrl.current?.abort();
      const ac = new AbortController();
      ctrl.current = ac;
      const zipName = `${name}.zip`;
      show({ name: zipName, total: Math.max(1, total), n: 0, done: false });
      try {
        const res = await fetch(`/api/client/documents/zip?folder=${encodeURIComponent(folder)}${engagementParam()}`, { signal: ac.signal });
        if (!res.ok) {
          const said = res.status === 400 ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : undefined;
          throw new Error(said || (res.status === 404 ? 'No files to download yet' : 'Could not prepare the ZIP'));
        }
        const files = Number(res.headers.get('X-Zip-Files') ?? total) || total;
        // The archive is streamed without a length; the summed file sizes are close enough for progress.
        const len = Number(res.headers.get('Content-Length') ?? res.headers.get('X-Zip-Bytes') ?? 0);
        const chunks: Uint8Array[] = [];
        let got = 0;
        const reader = res.body?.getReader();
        if (reader) {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            got += value.length;
            if (len) show({ name: zipName, total: files, n: Math.min(files - 1, Math.floor((got / len) * files)), done: false });
          }
        }
        const blob = reader ? new Blob(chunks as BlobPart[], { type: 'application/zip' }) : await res.blob();
        const url = URL.createObjectURL(blob);
        triggerDownload(url, zipName);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        show({ name: zipName, total: files, n: files, done: true });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        show({ name: zipName, total: 0, n: 0, done: true, error: (e as Error).message });
      }
    },
    [show],
  );

  const copied = useCallback(() => {
    ctrl.current?.abort();
    show({ name: 'Link copied', total: 0, n: 0, done: true, copy: true });
  }, [show]);

  useEffect(() => () => ctrl.current?.abort(), []);

  return { startZip, copied, dismiss };
}

/** The A2 dark toast line with a status tile (green done, red error, quiet while it works) and a progress bar. */
export function ZipToast({ t, visible = true, theme, onClose }: { t: ZipToastState; visible?: boolean; theme?: 'light' | 'dark'; onClose: () => void }) {
  const text = t.error ? t.error : t.copy ? 'Link copied' : t.done ? `Downloaded ${t.name}` : `Preparing ${t.name}…`;
  const count = t.error || t.copy ? '' : t.done ? `${t.total} files` : `${t.n} of ${t.total}`;
  const tile = t.done ? (t.error ? 'bg-danger-mid' : 'bg-positive-mid') : 'bg-white/[.14]';
  return (
    <div
      data-theme={theme}
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-2 rounded-md bg-side px-3 py-2.5 text-white shadow-float',
        visible ? 'opacity-100' : 'opacity-0',
        'transition-opacity duration-150 motion-reduce:transition-none',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn('grid h-[22px] w-[22px] flex-none place-items-center rounded-mark', tile)} aria-hidden>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={t.done ? (t.error ? 'M12 7v6 M12 16.5h.01' : 'M5 12.5l4.5 4.5L19 7.5') : 'M6 3.5h8l4 4v13H6Z M10 3.5v2 M10 7.5v2 M10 11.5v2'} />
          </svg>
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-medium">{text}</span>
        <span className="font-mono text-[12px] opacity-75">{count}</span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="grid h-6 w-6 flex-none place-items-center rounded-sm text-side-ink hover:bg-white/[.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
        </button>
      </div>
      {!t.done ? (
        <div className="h-1 overflow-hidden rounded-[3px] bg-white/[.18]">
          <span className="block h-full bg-brand transition-[width] duration-200" style={{ width: `${t.total ? (t.n / t.total) * 100 : 0}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- links, viewer docs ---------------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function docLink(param: 'doc' | 'folder', id: string): string {
  return `${window.location.origin}/app/client/documents?${param}=${encodeURIComponent(id)}`;
}

export function toViewerDoc(n: DocNode, stepLabel?: string): ViewerDoc {
  const ref = n.ref ?? '';
  return {
    id: n.id,
    name: n.fileName && n.fileName !== '—' ? n.fileName : n.label,
    url: async () => fileUrl(ref),
    downloadUrl: async () => fileUrl(ref, true),
    contentType: n.contentType,
    sizeBytes: n.sizeBytes,
    meta: stepLabel,
    // v7x_doc_viewer header: type, name, ⓘ, n of N, Download, close — no status chip
    // (the status badge lives in the explorer pane, navy for Final).
    uploadedAt: n.date,
    uploadedBy: n.from,
  };
}

export function downloadNode(n: DocNode) {
  if (!n.ref) return;
  triggerDownload(fileUrl(n.ref, true), n.fileName);
}

/** Width < 700 → the phone boards (prototype router, proto.js:94). */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 699px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
