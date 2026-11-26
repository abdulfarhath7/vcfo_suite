'use client';

import { useCallback, useRef } from 'react';
import { Eye, Loader2, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiveStream } from './use-live-stream';

/**
 * The remote portal's screen. In `watch` mode it is a picture only: no handler is attached and the
 * broker drops any input a watch token sends. In `act` mode (the portal tab) clicks, wheel, keys
 * and pasted text go to the server browser. Keys are forwarded and never kept: nothing here logs,
 * stores or echoes them.
 */

const MODS = (e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
const BUTTON = ['left', 'middle', 'right'] as const;

/** The text a key carries: a printable character, or a carriage return for Enter. */
function keyText(e: React.KeyboardEvent): string | undefined {
  if (e.key === 'Enter') return '\r';
  return e.key.length === 1 ? e.key : undefined;
}

export function LiveScreen({ stream, mode, label, className }: { stream: LiveStream; mode: 'watch' | 'act'; label: string; className?: string }) {
  const { imgRef, viewport, hasFrame, connected, send } = stream;
  const lastMove = useRef(0);
  const act = mode === 'act';

  /** The remote page's CSS pixel under the pointer (the frame is drawn at the viewport's size). */
  const point = useCallback(
    (e: { clientX: number; clientY: number; currentTarget: EventTarget }) => {
      const img = (e.currentTarget as HTMLElement).querySelector('img');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: ((e.clientX - r.left) / r.width) * viewport.w, y: ((e.clientY - r.top) / r.height) * viewport.h };
    },
    [viewport],
  );

  const onMouse = (type: 'mousePressed' | 'mouseReleased' | 'mouseMoved') => (e: React.MouseEvent) => {
    if (!act) return;
    if (type === 'mouseMoved') {
      const now = performance.now();
      if (now - lastMove.current < 40) return;
      lastMove.current = now;
    }
    if (type === 'mousePressed') (e.currentTarget as HTMLElement).focus();
    const p = point(e);
    if (!p) return;
    e.preventDefault();
    send({ t: 'mouse', type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : (BUTTON[e.button] ?? 'left'), clickCount: type === 'mouseMoved' ? 0 : Math.max(1, e.detail), modifiers: MODS(e) });
  };

  const onKey = (type: 'keyDown' | 'keyUp') => (e: React.KeyboardEvent) => {
    if (!act) return;
    // Copy and paste stay local; the paste handler sends the text.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'c')) return;
    e.preventDefault();
    send({ t: 'key', type, key: e.key, code: e.code, text: type === 'keyDown' ? keyText(e) : undefined, keyCode: e.keyCode, modifiers: MODS(e) });
  };

  return (
    <div
      className={cn('relative overflow-hidden rounded-lg border border-line bg-surface-sunken outline-none', act && 'cursor-default focus-visible:ring-4 focus-visible:ring-focus-ring/25', className)}
      style={{ aspectRatio: `${viewport.w} / ${viewport.h}` }}
      tabIndex={act ? 0 : -1}
      role={act ? 'application' : 'img'}
      aria-label={act ? `${label}: the live portal. Click and type here.` : `${label}: the live portal, watch only`}
      data-testid={act ? 'live-screen-act' : 'live-screen-watch'}
      onMouseDown={act ? onMouse('mousePressed') : undefined}
      onMouseUp={act ? onMouse('mouseReleased') : undefined}
      onMouseMove={act ? onMouse('mouseMoved') : undefined}
      onContextMenu={act ? (e) => e.preventDefault() : undefined}
      onWheel={
        act
          ? (e) => {
              const p = point(e);
              if (p) send({ t: 'wheel', x: p.x, y: p.y, dx: e.deltaX, dy: e.deltaY });
            }
          : undefined
      }
      onKeyDown={act ? onKey('keyDown') : undefined}
      onKeyUp={act ? onKey('keyUp') : undefined}
      onPaste={
        act
          ? (e) => {
              const text = e.clipboardData.getData('text/plain').slice(0, 1000);
              if (text) send({ t: 'text', text });
              e.preventDefault();
            }
          : undefined
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- frames are data URLs painted per frame */}
      <img ref={imgRef} alt="" draggable={false} className={cn('block h-full w-full select-none object-contain', !hasFrame && 'invisible')} data-testid="live-frame" />
      {!hasFrame ? (
        <div className="absolute inset-0 grid place-items-center text-[13px] text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {connected ? 'Waiting for the portal…' : 'Connecting to the live browser…'}
          </span>
        </div>
      ) : null}
      <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-navy/80 px-2 py-0.5 text-[11px] font-medium text-white">
        {act ? <MousePointer2 className="h-3 w-3" aria-hidden /> : <Eye className="h-3 w-3" aria-hidden />}
        {act ? 'Live · you can type here' : 'Live · watch only'}
      </span>
    </div>
  );
}
