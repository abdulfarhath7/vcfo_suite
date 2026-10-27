'use client';

/**
 * Phone preview sheet (prototype s/docs/docs_mobile_preview.dc.html): sheet
 * from the top 28 px, handle, title + status / source chips + date, swipeable
 * pages with the dot pager "Page 1 of N · swipe", footer Ask VCFO · Download.
 */
import { useEffect, useRef, useState } from 'react';
import type { DocNode } from '@/lib/client-portal/documents';
import { usePortal } from '@/components/client-portal/PortalProvider';
import { fileTag, longDate, previewMode } from './file-types';
import { fileUrl, STATUS_STYLE } from './model';
import { BotFace, downloadNode, PagePortal } from './shared-ui';

async function countPdfPages(blob: Blob): Promise<number> {
  try {
    const text = await blob.text();
    const n = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
    if (n) return n;
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
    return Math.max(1, ...counts);
  } catch {
    return 1;
  }
}

export function MobilePreview({ node, company, onClose }: { node: DocNode; company: string; onClose: () => void }) {
  const { openChat } = usePortal();
  const tag = fileTag(node.fileName, node.contentType);
  const mode = previewMode(tag);
  const [src, setSrc] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const docx = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  useEffect(() => {
    if (!node.ref || mode === 'none') return;
    let alive = true;
    let obj: string | null = null;
    (async () => {
      try {
        const res = await fetch(fileUrl(node.ref!), { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        if (!alive) return;
        if (mode === 'docx') {
          const { renderAsync } = await import('docx-preview');
          if (!alive || !docx.current) return;
          await renderAsync(blob, docx.current, undefined, { inWrapper: true, ignoreWidth: true, ignoreHeight: true, breakPages: true });
          setPages(docx.current.querySelectorAll('section.docx').length || 1);
          setSrc('docx');
          return;
        }
        obj = URL.createObjectURL(mode === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob);
        setPages(mode === 'pdf' ? Math.min(20, await countPdfPages(blob)) : 1);
        if (alive) setSrc(obj);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [node.ref, mode, reload]);

  const paperStyle = {
    width: 330,
    maxWidth: '100%',
    height: 466,
    maxHeight: '100%',
    background: 'light-dark(#fff, oklch(13% 0 89.9))',
    boxShadow: '0 2px 6px oklch(25% 0.04 264 / .12),0 18px 40px -18px oklch(25% 0.06 264 / .35)',
    boxSizing: 'border-box' as const,
    overflow: 'hidden',
  };

  return (
    <PagePortal>
      <div className="vmp">
        <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 2147482600, background: 'oklch(20% 0.05 258)', fontFamily: 'var(--font-sans),system-ui,sans-serif', color: 'var(--fg)', fontSize: 13 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
          <div role="dialog" aria-modal="true" aria-label={`Preview: ${node.label}`} className="sheet" style={{ position: 'absolute', left: 0, right: 0, top: 28, bottom: 0, background: 'var(--panel)', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
              <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <h2 style={{ margin: 0, font: '600 15px var(--font-sans),sans-serif', color: 'var(--navy-ink,var(--navy))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</h2>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <span className="chip" style={STATUS_STYLE[node.status]}>
                    {node.status}
                  </span>
                  <span className="chip" style={node.fromSbc ? { background: 'var(--gold-soft)', color: 'var(--gold-text)' } : { background: 'var(--raised)', color: 'var(--muted)' }}>
                    {node.fromSbc ? 'SBC' : company}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)', alignSelf: 'center' }}>
                    {longDate(node.date)}
                  </span>
                </div>
              </div>
              <button ref={closeRef} type="button" aria-label="Close preview" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', border: 0, background: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, background: 'light-dark(oklch(93.5% 0.01 255), oklch(22.8% 0.01 255))', padding: 16, display: 'flex', justifyContent: 'center', overflow: mode === 'docx' ? 'auto' : 'hidden' }}>
              {mode === 'none' || failed ? (
                <div role={failed ? 'alert' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
                  {failed ? (
                    <span style={{ width: 48, height: 48, borderRadius: 99, background: 'var(--over-light)', color: 'var(--over-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 20px var(--font-sans),sans-serif' }}>!</span>
                  ) : null}
                  <div style={{ fontSize: 15, fontWeight: 700, color: failed ? 'var(--over-text)' : undefined }}>{failed ? 'Could not open this file' : 'Preview not available for this file type'}</div>
                  {failed ? (
                    <button
                      type="button"
                      className="btn btn-o"
                      onClick={() => {
                        setFailed(false);
                        setReload((r) => r + 1);
                      }}
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              ) : mode === 'docx' ? (
                <div data-paper className="vmp-paper" style={{ ...paperStyle, height: 'auto', maxHeight: 'none', padding: '28px 26px' }}>
                  <div className="cp-tw dv-docx" ref={docx} />
                </div>
              ) : (
                <div
                  ref={strip}
                  className="vmp-pages"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
                  }}
                >
                  {Array.from({ length: pages }, (_, i) => (
                    <div key={i} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <div data-paper className="vmp-paper" style={paperStyle}>
                        {src ? (
                          mode === 'pdf' ? (
                            <iframe title={`${node.label} — page ${i + 1}`} src={`${src}#page=${i + 1}&toolbar=0&navpanes=0&view=Fit`} />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt={node.label} />
                          )
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(mode === 'pdf' || mode === 'image') && !failed ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderTop: '1px solid var(--hair)' }}>
                {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
                  <span key={i} style={{ width: i === page ? 18 : 6, height: 4, borderRadius: 2, background: i === page ? 'var(--navy)' : 'var(--border)', transition: 'width .2s' }} />
                ))}
                <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)', marginLeft: 6 }}>
                  Page {page + 1} of {pages}
                  {pages > 1 ? ' · swipe' : ''}
                </span>
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 16px 20px', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-o" onClick={() => (onClose(), openChat(`Tell me about ${node.label}`))}>
                <BotFace size={18} />
                Ask VCFO
              </button>
              <button type="button" className="btn btn-n" onClick={() => downloadNode(node)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14" />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </PagePortal>
  );
}
