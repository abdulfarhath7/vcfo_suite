'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileBadge } from '@/components/ui/file-badge';
import { fileUrl, previewKind, type VaultRef } from '@/views/vault/vault-files';

/*
 * Staff document viewer (prototype `DocViewerScreen`, v7x_doc_viewer). An overlay over the Vault:
 * a toolbar with the badge, the file name, "From … · date · size", "3 of 12", Download and Close
 * (Esc), the file itself through the same-origin preview route, previous and next (floating
 * chevrons from md, a bar on a phone, arrow keys), and a zoom pill for images. A PDF shows in
 * the browser's own viewer, which carries its own page and zoom controls, so the pill is left
 * out for PDFs. Files the browser cannot show get the no-preview card with Download.
 */

export interface DocViewerItem {
  id: string;
  fileName: string;
  /** "From Northwind · 14 Oct 2026 · 1.2 MB": the line under the file name. */
  meta: string;
  /** What the preview and download routes take; null when neither can name the file. */
  fileRef: VaultRef | null;
  contentType?: string | null;
  /** Shown in place of Download when the routes cannot name the file (the old signed-URL link). */
  fallback?: ReactNode;
}

const ZOOMS = [50, 75, 100, 125, 150, 200];

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, iframe, [tabindex]:not([tabindex="-1"])';

export function DocViewerOverlay({
  items,
  currentId,
  onGo,
  onClose,
}: {
  items: DocViewerItem[];
  currentId: string;
  onGo: (id: string) => void;
  onClose: () => void;
}) {
  const pos = Math.max(0, items.findIndex((x) => x.id === currentId));
  const item = items[pos];
  const many = items.length > 1;
  const prev = many ? items[(pos - 1 + items.length) % items.length] : null;
  const next = many ? items[(pos + 1) % items.length] : null;
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(100);

  // A new file starts at 100%.
  useEffect(() => setZoom(100), [currentId]);

  const go = useCallback((target: DocViewerItem | null) => target && onGo(target.id), [onGo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // aria-modal: Tab stays inside the viewer.
      if (e.key === 'Tab' && dialog.current) {
        const all = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
        if (all.length) {
          const first = all[0];
          const last = all[all.length - 1];
          const inside = dialog.current.contains(document.activeElement);
          if (e.shiftKey && (!inside || document.activeElement === first)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(prev);
      else if (e.key === 'ArrowRight') go(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go, prev, next]);

  // The overlay owns the screen: the page under it does not scroll, and focus starts on Close.
  useEffect(() => {
    closeBtn.current?.focus();
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = was;
    };
  }, []);

  if (!item) return null;
  const kind = item.fileRef ? previewKind(item.fileName, item.contentType) : null;
  const download = item.fileRef ? fileUrl(item.fileRef, 'download') : null;
  const src = item.fileRef ? fileUrl(item.fileRef) : null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close preview"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-scrim"
      />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${item.fileName}`}
        className="absolute inset-0 flex flex-col overflow-hidden bg-surface-raised md:inset-x-5 md:bottom-auto md:top-1/2 md:mx-auto md:h-[min(720px,calc(100vh-40px))] md:max-w-[1200px] md:-translate-y-1/2 md:rounded-md md:border-1.5 md:border-line md:shadow-dialog"
      >
        <div className="flex min-h-[54px] flex-none flex-wrap items-center gap-3 border-b border-line-soft px-3 py-2 md:px-4">
          <FileBadge name={item.fileName} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">{item.fileName}</span>
            {item.meta ? <span className="block truncate text-[12.5px] text-ink-muted">{item.meta}</span> : null}
          </span>
          {many ? (
            <span className="text-[12.5px] tabular-nums text-ink-muted" aria-label={`File ${pos + 1} of ${items.length}`}>
              {pos + 1} of {items.length}
            </span>
          ) : null}
          {download ? (
            <Button asChild size="sm" variant="secondary">
              <a href={download} aria-label={`Download ${item.fileName}`}>
                <Download aria-hidden /> <span className="hidden sm:inline">Download</span>
              </a>
            </Button>
          ) : null}
          <Button
            ref={closeBtn}
            type="button"
            size="iconSm"
            variant="secondary"
            onClick={onClose}
            aria-label="Close preview (Esc)"
            title="Close (Esc)"
          >
            <X aria-hidden />
          </Button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-surface-sunken px-3 pb-20 pt-7 md:px-16 md:pb-16">
          {kind === 'pdf' && src ? (
            <iframe
              key={item.id}
              src={src}
              title={`Preview of ${item.fileName}`}
              className="mx-auto block h-full min-h-[480px] w-full max-w-[920px] rounded-md border-1.5 border-line bg-surface-raised"
            />
          ) : kind === 'image' && src ? (
            <div className="grid min-h-full place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- a private, same-origin stream; next/image would cache it */}
              <img
                key={item.id}
                src={src}
                alt={item.fileName}
                style={zoom === 100 ? { maxWidth: '100%' } : { width: `${zoom}%`, maxWidth: 'none' }}
                className="rounded-md border-1.5 border-line bg-surface-raised object-contain shadow-tile"
              />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[420px] pt-10">
              <div className="grid place-items-center gap-3 rounded-md border-1.5 border-line bg-surface-raised px-4 py-10 text-center">
                <FileBadge name={item.fileName} />
                <span className="text-[14px] font-medium text-ink">Preview not available for this file type</span>
                {download ? (
                  <Button asChild size="sm">
                    <a href={download}>
                      <Download aria-hidden /> Download
                    </a>
                  </Button>
                ) : (
                  item.fallback ?? null
                )}
              </div>
            </div>
          )}
        </div>

        {prev ? (
          <button
            type="button"
            onClick={() => go(prev)}
            aria-label="Previous document"
            className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-md border-1.5 border-line-strong bg-surface-raised text-ink-2 shadow-float hover:bg-surface-sunken hover:text-ink md:grid"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
          </button>
        ) : null}
        {next ? (
          <button
            type="button"
            onClick={() => go(next)}
            aria-label="Next document"
            className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-md border-1.5 border-line-strong bg-surface-raised text-ink-2 shadow-float hover:bg-surface-sunken hover:text-ink md:grid"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
          </button>
        ) : null}

        {kind === 'image' ? (
          <div className="absolute bottom-16 left-1/2 flex h-[38px] -translate-x-1/2 items-center gap-1 rounded-md border-1.5 border-line bg-surface-raised px-2 text-[13px] font-medium text-ink shadow-float md:bottom-4">
            <span className="whitespace-nowrap px-1.5">Page 1 / 1</span>
            <span className="mx-1 h-4 w-px bg-line" aria-hidden />
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= ZOOMS[0]}
              onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])}
              className="grid h-7 w-7 place-items-center rounded-sm hover:bg-surface-sunken disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
            </button>
            <button type="button" onClick={() => setZoom(100)} aria-label="Reset zoom" className="h-7 w-12 rounded-sm tabular-nums hover:bg-surface-sunken">
              {zoom}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= ZOOMS[ZOOMS.length - 1]}
              onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])}
              className="grid h-7 w-7 place-items-center rounded-sm hover:bg-surface-sunken disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
            </button>
          </div>
        ) : null}

        {many ? (
          <div className="flex flex-none items-center justify-between gap-2 border-t border-line-soft bg-surface-raised px-3 py-2 md:hidden">
            <Button type="button" size="sm" variant="secondary" onClick={() => go(prev)}>
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => go(next)}>
              Next <ChevronRight aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
