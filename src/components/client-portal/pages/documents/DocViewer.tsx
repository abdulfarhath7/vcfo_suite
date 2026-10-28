'use client';

/**
 * Shared document viewer overlay (prototype v7x_doc_viewer, route `doc-viewer`).
 * CONTRACT used by every page (Home, Documents, Incorporation, Compliances,
 * Credentials): open it with a list of documents and the index to show.
 *
 *  - Esc / × close (focus returns to the opener) · ← / → and the round buttons
 *    cycle the list (wraps) · − / + and the navy bar zoom 50–150 % in 25 %
 *    steps (paper width 460 px × zoom, `.2s`).
 *  - PDF → the browser's own renderer inside the paper; JPG / PNG / WEBP →
 *    `<img>`; DOCX → `docx-preview` inside a `.cp-tw` island; anything else →
 *    the board's "Preview not available for this file type" dialog.
 *  - The paper is a `[data-paper]` island: always white paper, also in dark mode.
 *
 * Same-origin URLs (the Documents file route) are fetched once as a blob, so
 * the size and page count are known and DOCX can be rendered; cross-origin
 * signed URLs go straight into the frame (S3 has no CORS for the app).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { InfoPopover } from '@/components/client-portal/shared';
import { LinkButton } from '@/components/client-portal/LinkButton';
import { fileTag, longDate, previewMode, sizeLabel, TAG_STYLE, triggerDownload } from './file-types';
import '../../css/documents-viewer.css';

export interface ViewerDoc {
  /** Stable id (document id, `step:field`, filing proof id…). */
  id: string;
  name: string;
  /** Lazily resolves a short-lived URL (signed S3 URL) for preview/download. */
  url: () => Promise<string>;
  contentType?: string | null;
  sizeBytes?: number | null;
  /** "Step 7 · Registered Office Address", "GSTR-3B · Sep 2026"… */
  meta?: string;
  /** Status chip text + tone, e.g. ["Final", "ok"]. */
  chip?: { text: string; tone: 'ok' | 'due' | 'over' | 'prog' | 'up' | 'violet' };
  uploadedAt?: string;
  uploadedBy?: string;
  /** Optional: a URL that forces a download (`Content-Disposition: attachment`). Defaults to `url()`. */
  downloadUrl?: () => Promise<string>;
}

export interface DocViewerProps {
  docs: ViewerDoc[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}

const ZMIN = 50;
const ZMAX = 150;
const ZSTEP = 25;

type Loaded =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; src: string; blob?: Blob; pages?: number; size?: number };

/** Page count from the PDF bytes: `/Type /Page` objects, else the page tree `/Count`. */
async function pdfPages(blob: Blob): Promise<number | undefined> {
  try {
    const text = await blob.text();
    const objs = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
    if (objs > 0) return objs;
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
    const max = counts.length ? Math.max(...counts) : 0;
    return max > 0 ? max : undefined;
  } catch {
    return undefined;
  }
}

function sameOrigin(url: string): boolean {
  if (url.startsWith('/')) return true;
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

function portalRoot(): Element {
  return document.querySelector('.cp') ?? document.body;
}

const ICON_DL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2" />
  </svg>
);

const S_DLG: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 6,
  overflow: 'hidden',
  background: 'oklch(var(--surface-sunken))',
  border: '1.5px solid oklch(var(--line))',
  boxShadow: 'var(--shadow-dialog)',
};
const S_NAV: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 40,
  height: 40,
  borderRadius: 6,
  border: '1.5px solid oklch(var(--line-strong))',
  background: 'oklch(var(--surface-raised))',
  color: 'oklch(var(--ink))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: 'var(--shadow-float)',
  zIndex: 2,
};
const S_ZB: CSSProperties = { width: 30, height: 30, border: 0, borderRadius: 6, background: 'transparent', color: 'oklch(var(--on-brand))', font: '500 16px var(--font-sans),sans-serif', cursor: 'pointer' };

export function DocViewer({ docs, index, onClose, onIndexChange }: DocViewerProps) {
  const [i, setI] = useState(() => Math.min(Math.max(index, 0), Math.max(docs.length - 1, 0)));
  useEffect(() => setI(Math.min(Math.max(index, 0), Math.max(docs.length - 1, 0))), [index, docs.length]);
  const [z, setZ] = useState(100);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const doc = docs[i];
  const n = docs.length;

  useEffect(() => {
    setMounted(true);
    opener.current = document.activeElement;
    const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 30);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      html.style.overflow = prev;
    };
  }, []);

  const close = useCallback(() => {
    onClose();
    const el = opener.current as HTMLElement | null;
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus({ preventScroll: true }), 0);
  }, [onClose]);

  const go = useCallback(
    (d: number) => {
      if (n < 2) return;
      const next = (i + d + n) % n;
      setI(next);
      onIndexChange?.(next);
    },
    [i, n, onIndexChange],
  );

  const tag = fileTag(doc?.name, doc?.contentType);
  const mode = previewMode(tag);

  /* ---------- load the file ---------- */
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!doc) return;
    let alive = true;
    let objectUrl: string | null = null;
    setLoaded({ state: 'loading' });
    (async () => {
      try {
        const url = await doc.url();
        if (!alive) return;
        if (mode === 'none') {
          setLoaded({ state: 'ready', src: url });
          return;
        }
        if (sameOrigin(url) || mode === 'docx') {
          const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          if (!alive) return;
          objectUrl = URL.createObjectURL(mode === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob);
          const pages = mode === 'pdf' ? await pdfPages(blob) : mode === 'image' ? 1 : undefined;
          if (!alive) return;
          setLoaded({ state: 'ready', src: objectUrl, blob, pages, size: blob.size });
        } else {
          setLoaded({ state: 'ready', src: url, pages: mode === 'image' ? 1 : undefined });
        }
      } catch {
        if (alive) setLoaded({ state: 'error' });
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, reload]);

  /* ---------- DOCX render ---------- */
  const docxRef = useRef<HTMLDivElement>(null);
  const [docxPages, setDocxPages] = useState<number | undefined>(undefined);
  const [docxFailed, setDocxFailed] = useState(false);
  useEffect(() => {
    setDocxPages(undefined);
    setDocxFailed(false);
    if (mode !== 'docx' || loaded.state !== 'ready' || !loaded.blob || !docxRef.current) return;
    let alive = true;
    const host = docxRef.current;
    host.innerHTML = '';
    import('docx-preview')
      .then(({ renderAsync }) =>
        renderAsync(loaded.blob!, host, undefined, {
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: true,
          experimental: false,
        }),
      )
      .then(() => {
        if (alive) setDocxPages(host.querySelectorAll('section.docx').length || 1);
      })
      .catch(() => {
        if (alive) setDocxFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [mode, loaded]);

  /* ---------- keys ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        // an open (i) pop-over closes first
        if (document.querySelector('.cp-docviewer .info.open')) return;
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') setZ((v) => Math.min(ZMAX, v + ZSTEP));
      else if (e.key === '-' || e.key === '_') setZ((v) => Math.max(ZMIN, v - ZSTEP));
      else if (e.key === 'Tab') {
        // keep focus inside the dialog
        const root = document.querySelector('.cp-docviewer [role="dialog"]');
        if (!root) return;
        const f = [...root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // Esc belongs to the viewer while it is open, even over another pop-up
    // (Home step pop-up, Compliances detail): catch it first, at the window,
    // in the capture phase, so the layer underneath never sees it.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.cp-docviewer .info.open')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener('keydown', onEsc, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onEsc, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [close, go]);

  const download = useCallback(async () => {
    if (!doc) return;
    try {
      const url = await (doc.downloadUrl ?? doc.url)();
      triggerDownload(url, doc.name);
    } catch {
      /* the button stays; a retry asks for a fresh URL */
    }
  }, [doc]);

  const size = sizeLabel(doc?.sizeBytes ?? (loaded.state === 'ready' ? loaded.size : undefined));
  const metaLine = useMemo(() => {
    if (!doc) return '';
    const parts: string[] = [];
    const from = doc.uploadedBy ? `From ${doc.uploadedBy}` : '';
    const date = doc.uploadedAt ? longDate(doc.uploadedAt) : '';
    if (from) parts.push(from);
    if (date && date !== '—') parts.push(date);
    if (size) parts.push(`Size ${size}`);
    if (doc.meta) parts.push(doc.meta);
    return parts.join(' · ');
  }, [doc, size]);

  if (!mounted || !doc) return null;

  const unsupported = mode === 'none' || docxFailed;
  const pages = mode === 'docx' ? docxPages : loaded.state === 'ready' ? loaded.pages : undefined;
  const pageW = `${Math.round((460 * z) / 100)}px`;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '8px 12px 8px 16px', boxSizing: 'border-box', background: 'oklch(var(--surface-raised))', borderBottom: '1px solid oklch(var(--line-soft))' }}>
      <span
        className="mono"
        role="img"
        aria-label={tag === 'FILE' ? 'File' : `${tag} file`}
        data-tip={tag === 'FILE' ? 'File' : `${tag} file`}
        data-tip-below=""
        style={{ width: 44, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono),monospace', fontSize: tag.length > 3 ? 10 : 11, fontWeight: 500, flex: 'none', ...TAG_STYLE[tag] }}
      >
        {tag === 'FILE' ? '—' : tag}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 500, color: 'oklch(var(--ink))' }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} id="dv-title">
          {doc.name}
        </span>
        {metaLine ? <InfoPopover askAbout={doc.name}>{metaLine}</InfoPopover> : null}
        {doc.chip ? (
          <span className="chip" style={{ marginLeft: 6, background: `var(--${doc.chip.tone}-light, var(--raised))`, color: `var(--${doc.chip.tone}-text, var(--muted))` }}>
            {doc.chip.text}
          </span>
        ) : null}
      </div>
      {!unsupported && n > 1 ? (
        <span className="cap" style={{ marginRight: 6, fontSize: 12.5, whiteSpace: 'nowrap', flex: 'none' }} aria-live="polite">
          {i + 1} of {n}
        </span>
      ) : null}
      <LinkButton className="sx-btn sm" aria-label="Download" style={{ flex: 'none' }} onClick={() => void download()}>
        {ICON_DL}
        <span className="vh-hide-sm">Download</span>
      </LinkButton>
      <button
        ref={closeRef}
        type="button"
        aria-label="Close preview (Esc)"
        title="Close (Esc)"
        onClick={close}
        className="sx-ib sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );

  const navButtons =
    n > 1 ? (
      <>
        <button type="button" className="dv-nav" aria-label="Previous document" onClick={() => go(-1)} style={{ ...S_NAV, left: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', transform: 'rotate(180deg)' }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" className="dv-nav" aria-label="Next document" onClick={() => go(1)} style={{ ...S_NAV, right: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </>
    ) : null;

  const paperBase: CSSProperties = {
    position: 'relative',
    width: pageW,
    maxWidth: '100%',
    flex: 'none',
    alignSelf: 'flex-start',
    background: 'oklch(var(--surface-raised))',
    border: '1.5px solid oklch(var(--line))',
    borderRadius: 4,
    boxSizing: 'border-box',
    overflow: 'hidden',
    transition: 'width .2s',
  };

  let paper: React.ReactNode;
  if (loaded.state === 'loading') {
    paper = (
      <div data-paper aria-busy="true" style={{ ...paperBase, aspectRatio: '1/1.414', padding: 'clamp(20px,5vw,48px) clamp(18px,5vw,52px)' }}>
        <div style={{ font: '500 22px var(--font-sans),sans-serif', color: 'oklch(var(--ink))' }} className="metric">
          {doc.name.replace(/\.[a-z0-9]+$/i, '')}
        </div>
        <div className="cap" style={{ marginTop: 4 }}>
          {doc.uploadedAt ? longDate(doc.uploadedAt) : ''}
        </div>
        {[92, 86, 95, 70, 88, 93, 60].map((w) => (
          <div key={w} className="dv-line" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  } else if (loaded.state === 'error') {
    paper = (
      <div data-paper role="alert" style={{ ...paperBase, aspectRatio: '1/1.414', padding: 'clamp(20px,5vw,48px) clamp(18px,5vw,52px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
        <span style={{ width: 40, height: 40, borderRadius: 6, background: 'oklch(var(--danger-soft))', color: 'oklch(var(--danger))', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 18px var(--font-sans),sans-serif' }}>!</span>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'oklch(var(--danger))' }}>Could not open this file</div>
        <button type="button" className="sx-btn sm" onClick={() => setReload((r) => r + 1)}>
          Try again
        </button>
      </div>
    );
  } else if (mode === 'pdf') {
    paper = (
      <div data-paper style={{ ...paperBase, aspectRatio: '1/1.414' }}>
        <iframe className="dv-frame" src={`${loaded.src}#toolbar=0&navpanes=0&view=FitH`} title={doc.name} />
      </div>
    );
  } else if (mode === 'image') {
    paper = (
      <div data-paper style={paperBase}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dv-img" src={loaded.src} alt={doc.name} />
      </div>
    );
  } else {
    paper = (
      <div data-paper style={{ ...paperBase, minHeight: docxPages ? undefined : 300, padding: 'clamp(20px,5vw,48px) clamp(18px,5vw,52px)' }}>
        <div className="cp-tw dv-docx" ref={docxRef} />
      </div>
    );
  }

  const body = unsupported ? (
    <div role="dialog" aria-modal="true" aria-label="Document preview" className="dv-dlg" style={{ ...S_DLG, width: 'min(860px,calc(100% - 24px))', minHeight: 380 }}>
      {header}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '24px 16px' }}>
        <span style={{ width: 44, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono),monospace', fontSize: 11, fontWeight: 500, ...TAG_STYLE[tag] }} aria-hidden="true">
          {tag}
        </span>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Preview not available for this file type</div>
        <LinkButton className="sx-btn sm p" onClick={() => void download()}>
          {ICON_DL}Download
        </LinkButton>
      </div>
    </div>
  ) : (
    <div role="dialog" aria-modal="true" aria-label="Document preview" className="dv-dlg" style={{ ...S_DLG, width: 'min(1152px,calc(100% - 24px))', height: 'min(720px,calc(100% - 24px))' }}>
      {header}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '28px clamp(12px,6vw,72px) 72px' }}>{paper}</div>
        {navButtons}
        <div
          className="vh-zoom"
          style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 6, background: 'oklch(var(--side))', color: 'oklch(var(--on-brand))', boxShadow: 'var(--shadow-float)', zIndex: 2 }}
        >
          {pages ? (
            <>
              <span style={{ padding: '0 10px', font: '500 12.5px var(--font-sans),sans-serif', whiteSpace: 'nowrap' }}>
                Page 1 / {pages}
              </span>
              <span style={{ width: 1, height: 18, background: 'oklch(100% 0 0 / .2)' }} />
            </>
          ) : null}
          <button type="button" className="dv-zb" aria-label="Zoom out" disabled={z <= ZMIN} onClick={() => setZ((v) => Math.max(ZMIN, v - ZSTEP))} style={S_ZB}>
            −
          </button>
          <span style={{ minWidth: 48, textAlign: 'center', font: '500 12.5px var(--font-sans),sans-serif' }} aria-live="polite">
            {z}%
          </span>
          <button type="button" className="dv-zb" aria-label="Zoom in" disabled={z >= ZMAX} onClick={() => setZ((v) => Math.min(ZMAX, v + ZSTEP))} style={S_ZB}>
            +
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="cp-docviewer" style={{ fontFamily: 'var(--font-sans),system-ui,sans-serif', color: 'oklch(var(--ink))', fontSize: 14 }}>
      <div
        className="vh-under-bar dv-scrim"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 'var(--vp-side-w,248px)', background: 'oklch(var(--side) / .6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147482700 }}
      >
        {body}
      </div>
    </div>,
    portalRoot(),
  );
}

/** Convenience hook: `const viewer = useDocViewer(); viewer.open(docs, i); {viewer.node}`. */
export function useDocViewer() {
  const [st, setSt] = useState<{ docs: ViewerDoc[]; index: number } | null>(null);
  const open = useCallback((docs: ViewerDoc[], index = 0) => setSt({ docs, index }), []);
  const close = useCallback(() => setSt(null), []);
  const node = st ? <DocViewer docs={st.docs} index={st.index} onClose={close} onIndexChange={(index) => setSt((s) => (s ? { ...s, index } : s))} /> : null;
  return { open, close, node, isOpen: !!st };
}
