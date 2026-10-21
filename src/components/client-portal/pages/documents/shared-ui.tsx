'use client';

/**
 * Pieces shared by the Documents explorer (desktop/tablet), the phone board,
 * the drill-down, the upload flow and the Library pages.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { usePortal } from '@/components/client-portal/PortalProvider';
import { VisorHead } from '@/components/client-portal/Visor';
import { LinkButton } from '@/components/client-portal/LinkButton';
import type { ClientDocumentsPayload, DocNode } from '@/lib/client-portal/documents';
import type { ViewerDoc } from './DocViewer';
import { fileUrl } from './model';
import { triggerDownload } from './file-types';

export const DOCS_KEY = ['client-portal', 'documents'] as const;

async function fetchClientDocuments(): Promise<ClientDocumentsPayload> {
  const res = await fetch('/api/client/documents', { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status === 404 ? 'none' : `documents ${res.status}`);
  return ((await res.json()) as { documents: ClientDocumentsPayload }).documents;
}

export function useClientDocuments() {
  return useQuery({ queryKey: DOCS_KEY, queryFn: fetchClientDocuments, staleTime: 15_000, retry: (n, e) => (e as Error).message !== 'none' && n < 2 });
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

/** Static bot head in a round tile (v7c_bot idle), sizes 16–56. */
export function BotFace({ size, style }: { size: number; style?: CSSProperties }) {
  const head = Math.round(size * 0.74);
  return (
    <span className="vdoc-bot" aria-hidden="true" style={{ width: size, height: size, ...style }}>
      <VisorHead style={{ width: head, height: Math.round(head * 1.26), marginTop: Math.round(head * 0.3) }} />
    </span>
  );
}

/** Rule 16 bubble exactly as the Documents boards draw it. */
export function BotBubble({
  size = 40,
  children,
  clear,
  ask = 'Ask VCFO why',
  question,
}: {
  size?: number;
  children: ReactNode;
  clear?: { label: string; onClick: () => void };
  ask?: string | null;
  question?: string;
}) {
  const { openChat } = usePortal();
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, justifyContent: 'center', textAlign: 'left' }}>
      <BotFace size={size} />
      <div className="vdoc-bubble">
        <span style={{ font: '600 13px/1.45 Manrope,sans-serif', color: 'var(--fg)' }}>{children}</span>
        {clear ? (
          <button
            type="button"
            onClick={clear.onClick}
            style={{ marginTop: 6, padding: 0, border: 0, background: 'none', font: '700 12px Manrope,sans-serif', color: 'var(--primary)', cursor: 'pointer' }}
          >
            {clear.label}
          </button>
        ) : null}
        {ask ? (
          <LinkButton
            onClick={() => openChat(question ?? (typeof children === 'string' ? `${ask}: ${children}` : ask))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}
          >
            {ask}
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- ZIP / copy toast (docs board .toast) ---------------- */

export interface ZipToastState {
  name: string;
  total: number;
  n: number;
  done: boolean;
  copy?: boolean;
  error?: string;
}

/**
 * Real ZIP download: streams `/api/client/documents/zip?folder=` and maps the
 * received bytes onto the board's "n of total" files counter (gold bar).
 */
export function useZipToast() {
  const [toast, setToast] = useState<ZipToastState | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    if (hide.current) clearTimeout(hide.current);
    setToast(null);
  }, []);

  const autoHide = useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    hide.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const startZip = useCallback(
    async (folder: string, name: string, total: number) => {
      ctrl.current?.abort();
      if (hide.current) clearTimeout(hide.current);
      const ac = new AbortController();
      ctrl.current = ac;
      const zipName = `${name}.zip`;
      setToast({ name: zipName, total: Math.max(1, total), n: 0, done: false });
      try {
        const res = await fetch(`/api/client/documents/zip?folder=${encodeURIComponent(folder)}`, { signal: ac.signal });
        if (!res.ok) throw new Error(res.status === 404 ? 'No files to download yet' : 'Could not prepare the ZIP');
        const files = Number(res.headers.get('X-Zip-Files') ?? total) || total;
        const len = Number(res.headers.get('Content-Length') ?? 0);
        const chunks: Uint8Array[] = [];
        let got = 0;
        const reader = res.body?.getReader();
        if (reader) {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            got += value.length;
            if (len) setToast({ name: zipName, total: files, n: Math.min(files - 1, Math.floor((got / len) * files)), done: false });
          }
        }
        const blob = reader ? new Blob(chunks as BlobPart[], { type: 'application/zip' }) : await res.blob();
        const url = URL.createObjectURL(blob);
        triggerDownload(url, zipName);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setToast({ name: zipName, total: files, n: files, done: true });
        autoHide();
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setToast({ name: zipName, total: 0, n: 0, done: true, error: (e as Error).message });
        autoHide();
      }
    },
    [autoHide],
  );

  const copied = useCallback(() => {
    ctrl.current?.abort();
    setToast({ name: 'Link copied', total: 0, n: 0, done: true, copy: true });
    autoHide();
  }, [autoHide]);

  useEffect(() => () => {
    ctrl.current?.abort();
    if (hide.current) clearTimeout(hide.current);
  }, []);

  return { toast, startZip, copied, dismiss };
}

export function ZipToast({ t, onClose }: { t: ZipToastState; onClose: () => void }) {
  const text = t.error ? t.error : t.copy ? 'Link copied' : t.done ? `Downloaded ${t.name}` : `Preparing ${t.name}…`;
  const count = t.error || t.copy ? '' : t.done ? `${t.total} files` : `${t.n} of ${t.total}`;
  return (
    <div className="toast" role="status" aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {t.done ? (
          <span style={{ width: 22, height: 22, borderRadius: 99, background: t.error ? 'var(--over-chip)' : 'var(--ok-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={t.error ? 'M12 7v6 M12 16.5h.01' : 'M5 12.5l4.5 4.5L19 7.5'} />
            </svg>
          </span>
        ) : (
          <span style={{ width: 22, height: 22, borderRadius: 99, background: 'oklch(100% 0 0 / .14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3.5h8l4 4v13H6Z M10 3.5v2 M10 7.5v2 M10 11.5v2" />
            </svg>
          </span>
        )}
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>{text}</span>
        <span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>
          {count}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          style={{ width: 24, height: 24, border: 0, borderRadius: 6, background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {!t.done ? (
        <div className="tbar">
          <span style={{ width: `${t.total ? (t.n / t.total) * 100 : 0}%` }} />
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
