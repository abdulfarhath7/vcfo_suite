'use client';

/**
 * Timeline view (T-01…T-14; cal-views.js timelineView()): a Gantt strip of
 * filing windows over the FY, lanes by area then filing, zoomable ruler
 * (− / slider / + / Fit, ctrl/⌘+wheel, pinch), drag-to-pan, red Today line.
 *
 * Clients plan their own working windows as in the prototype (TL-13 owner
 * decision, DECISIONS › Compliances): drag a bar to move it, drag its edges to
 * resize, ←/→ moves (shift resizes), ↶ Undo + undo toast. The statutory due
 * date (diamond) never moves; filed windows are locked. Saved through
 * POST /api/client/compliances/:id/window (ownership checked in the
 * repository). A click without a drag, or Enter, opens the filing. Windows
 * come from compliance_instances.window_from/to, else due − PREP days.
 * C-4: non-statutory tasks shared with the client sit in their own "Non-statutory" group after
 * the areas. Their bar runs from the start date to the end date, drawn hollow (C-3), and it is
 * locked: SBC sets those dates. A click opens the task page.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortal } from '../../PortalProvider';
import { COMP_KEY } from './api';
import {
  AREA_LABEL,
  AREA_ORDER,
  MON,
  MONTHS,
  statusOf,
  type AreaCode,
  type CompStatus,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { isTaskRow, taskHint } from './tasks';

const DAY = 86_400_000;
const ZMAX = 40;
const PREP: Record<string, number> = { monthly: 5, quarterly: 10, 'half-yearly': 10, annual: 21 };
/** Status colours (R-25): upcoming is grey, not navy. */
const STC: Record<CompStatus, string> = { ok: 'var(--ok-mid)', due: 'var(--due-mid)', over: 'var(--over-mid)', up: 'oklch(var(--upcoming-mid))' };

type Lane = { ar: AreaCode } | { grp: string } | { name: string; items: PortalFiling[] };

export function TimelineView({ fyStart, rows, today, onOpen }: { fyStart: number; rows: PortalFiling[]; today: string; onOpen: (f: PortalFiling) => void }) {
  const { toast } = usePortal();
  const qc = useQueryClient();
  const W0 = Date.UTC(fyStart, 3, 1);
  const W1 = Date.UTC(fyStart + 1, 2, 31);
  const NDAYS = Math.round((W1 - W0) / DAY);
  const dayN = useCallback((s: string) => Math.round((Date.parse(`${s.slice(0, 10)}T00:00:00Z`) - W0) / DAY), [W0]);
  const nStr = useCallback((n: number) => {
    const d = new Date(W0 + n * DAY);
    return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  }, [W0]);

  const lanes = useMemo<Lane[]>(() => {
    const inRange = rows.filter((r) => dayN(r.dueDate) >= 0 && dayN(r.dueDate) <= NDAYS);
    const out: Lane[] = [];
    for (const a of AREA_ORDER) {
      const inA = inRange.filter((r) => r.area === a && !isTaskRow(r));
      if (!inA.length) continue;
      out.push({ ar: a });
      const names = new Map<string, PortalFiling[]>();
      for (const r of inA) {
        const k = r.name;
        const l = names.get(k);
        if (l) l.push(r);
        else names.set(k, [r]);
      }
      for (const [name, items] of names) out.push({ name, items });
    }
    const tasks = inRange.filter(isTaskRow);
    if (tasks.length) {
      out.push({ grp: 'Non-statutory' });
      const names = new Map<string, PortalFiling[]>();
      for (const r of tasks) names.set(r.name, [...(names.get(r.name) ?? []), r]);
      for (const [name, items] of names) out.push({ name, items });
    }
    return out;
  }, [rows, dayN, NDAYS]);

  const vp = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  const [ppd, setPpd] = useState(0);
  const zoomed = useRef(false);
  const pendingScroll = useRef<number | null>(null);

  const minP = vw / NDAYS;
  const fitP = Math.max(minP, Math.min(ZMAX, vw / 61));
  const startKey = today >= `${fyStart}-04-01` && today <= `${fyStart + 1}-03-31` ? `${today.slice(0, 7)}-01` : `${fyStart}-04-01`;
  const anchorDay = dayN(startKey);

  useLayoutEffect(() => {
    const el = vp.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    setVw(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // initial fit + re-fit on resize unless the user zoomed
  useEffect(() => {
    if (!vw) return;
    if (!zoomed.current || ppd === 0) {
      const first = ppd === 0;
      setPpd(fitP);
      if (first) pendingScroll.current = anchorDay * fitP - 4;
    }
  }, [vw, fitP, anchorDay, ppd]);
  useLayoutEffect(() => {
    if (pendingScroll.current != null && vp.current) {
      vp.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  });

  const zoomTo = useCallback(
    (np: number, ax?: number, anchor?: number) => {
      const el = vp.current;
      if (!el || !ppd) return;
      np = Math.max(minP, Math.min(ZMAX, np));
      const a = ax ?? el.clientWidth / 2;
      const dayAt = anchor != null ? anchor : (el.scrollLeft + a) / ppd;
      zoomed.current = true;
      pendingScroll.current = anchor != null ? anchor * np - 4 : dayAt * np - a;
      setPpd(np);
    },
    [ppd, minP],
  );

  // ctrl/⌘ + wheel zoom (non-passive)
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(ppd * Math.exp(-e.deltaY * 0.01), e.clientX - r.left);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoomTo, ppd]);

  // pan (mouse drag) + pinch (two pointers)
  const pts = useRef(new Map<number, number>());
  const pan = useRef<{ x: number; s: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; p: number; mid: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    const el = vp.current!;
    pts.current.set(e.pointerId, e.clientX);
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()] as [number, number];
      const rr = el.getBoundingClientRect();
      pinch.current = { d: Math.abs(a - b) || 1, p: ppd, mid: (a + b) / 2 - rr.left };
      pan.current = null;
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 0) {
      pan.current = { x: e.clientX, s: el.scrollLeft, moved: false };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, e.clientX);
    if (pinch.current && pts.current.size === 2) {
      const [a, b] = [...pts.current.values()] as [number, number];
      zoomTo((pinch.current.p * (Math.abs(a - b) || 1)) / pinch.current.d, pinch.current.mid);
      return;
    }
    if (pan.current) {
      const dx = e.clientX - pan.current.x;
      if (Math.abs(dx) > 3 && !pan.current.moved) {
        pan.current.moved = true;
        setPanning(true);
      }
      if (pan.current.moved) vp.current!.scrollLeft = pan.current.s - dx;
    }
  };
  const end = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    if (pan.current) {
      const moved = pan.current.moved;
      pan.current = null;
      setPanning(false);
      if (moved) {
        const stop = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        window.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
      }
    }
  };

  /* ---------- client window editing (drag / resize / keys / undo) ---------- */
  type Win = [number, number];
  const [W, setW] = useState<Record<string, Win>>({});
  const hist = useRef<{ id: string; prev: Win | null }[]>([]);
  const [histN, setHistN] = useState(0);
  const drag = useRef<{ r: PortalFiling; mode: 'move' | 'start' | 'end'; x0: number; s0: number; e0: number; moved: boolean; sn: number; prev: Win | null; locked: boolean } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [read, setRead] = useState<{ x: number; y: number; t: string } | null>(null);
  const snap = ppd && ppd < 7 ? 7 : 1;
  const winOf = useCallback(
    (r: PortalFiling): { s: number; e: number; due: number; set: boolean } => {
      const due = dayN(r.dueDate);
      const o = W[r.id];
      if (o) return { s: o[0], e: o[1], due, set: true };
      const set = Boolean(r.windowFrom && r.windowTo);
      return set ? { s: dayN(r.windowFrom!), e: dayN(r.windowTo!), due, set } : { s: due - (PREP[r.frequency.toLowerCase()] ?? 5), e: due, due, set };
    },
    [W, dayN],
  );
  const iso = useCallback((n: number) => new Date(W0 + n * DAY).toISOString().slice(0, 10), [W0]);
  const save = useCallback(
    async (r: PortalFiling, w: Win | null, revert: Win | null | undefined) => {
      try {
        const res = await fetch(`/api/client/compliances/${r.id}/window`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(w ? { from: iso(w[0]), to: iso(w[1]) } : { from: null, to: null }),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'save_failed');
        void qc.invalidateQueries({ queryKey: COMP_KEY });
      } catch {
        setW((m) => {
          const n = { ...m };
          if (revert) n[r.id] = revert;
          else delete n[r.id];
          return n;
        });
        toast(`Could not save the ${r.name} window. It is back where it was.`);
      }
    },
    [iso, qc, toast],
  );
  const apply = useCallback(
    (r: PortalFiling, w: Win | null) => {
      setW((m) => {
        const n = { ...m };
        if (w) n[r.id] = w;
        else delete n[r.id];
        return n;
      });
    },
    [],
  );
  const commit = useCallback(
    (r: PortalFiling, prev: Win | null, next: Win, withToast: boolean) => {
      hist.current.push({ id: r.id, prev });
      setHistN(hist.current.length);
      apply(r, next);
      void save(r, next, prev);
      if (withToast) {
        const due = dayN(r.dueDate);
        toast(`${r.name} window · ${nStr(next[0])} – ${nStr(next[1])}${next[1] > due ? ' · ends after the due date' : ''}`, { undo: () => undo() });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apply, save, dayN, nStr, toast],
  );
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  function undo() {
    const h = hist.current.pop();
    setHistN(hist.current.length);
    if (!h) return;
    const r = byId.get(h.id);
    if (!r) return;
    apply(r, h.prev);
    // back to the previous window (or clear a window this client created)
    void save(r, h.prev, null);
    toast('Undone');
  }
  const prevOf = (r: PortalFiling): Win | null => {
    if (W[r.id]) return W[r.id]!;
    return r.windowFrom && r.windowTo ? [dayN(r.windowFrom), dayN(r.windowTo)] : null;
  };
  const barDown = (e: React.PointerEvent, r: PortalFiling) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    const w = winOf(r);
    const h = (e.target as HTMLElement).closest('.hd');
    // a filed window is locked: the press still opens it on release
    drag.current = { r, mode: h ? (h.getAttribute('data-h') === 'l' ? 'start' : 'end') : 'move', x0: e.clientX, s0: w.s, e0: w.e, moved: false, sn: snap, prev: prevOf(r), locked: Boolean(r.filedOn) || isTaskRow(r) };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const barMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !ppd || d.locked) return;
    const dd = Math.round((e.clientX - d.x0) / ppd / d.sn) * d.sn;
    if (!dd && !d.moved) return;
    if (!d.moved) {
      d.moved = true;
      setDragId(d.r.id);
    }
    let s0 = d.s0;
    let e0 = d.e0;
    if (d.mode === 'move') {
      s0 += dd;
      e0 += dd;
    } else if (d.mode === 'start') s0 = Math.min(e0 - 1, s0 + dd);
    else e0 = Math.max(s0 + 1, e0 + dd);
    s0 = Math.max(0, s0);
    e0 = Math.min(NDAYS, e0);
    apply(d.r, [s0, e0]);
    const due = dayN(d.r.dueDate);
    setRead({ x: e.clientX, y: e.clientY, t: `${nStr(s0)} – ${nStr(e0)} · ${e0 - s0} days${e0 > due ? ' · after the due date' : ''}` });
  };
  const barUp = (r: PortalFiling) => {
    const d = drag.current;
    drag.current = null;
    setRead(null);
    setDragId(null);
    if (!d || d.r.id !== r.id) return;
    if (!d.moved) {
      onOpen(r);
      return;
    }
    const w = W[r.id];
    const next: Win = w ?? [d.s0, d.e0];
    // swallow the click that follows the drag
    const stop = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    if (next[0] === d.s0 && next[1] === d.e0) return;
    // drag already applied the live window; record history from the pre-drag state
    commit(r, d.prev, next, true);
  };
  const barKey = (ev: React.KeyboardEvent, r: PortalFiling) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onOpen(r);
      return;
    }
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    if (r.filedOn || isTaskRow(r)) return;
    ev.preventDefault();
    const w = winOf(r);
    const d = (ev.key === 'ArrowRight' ? 1 : -1) * snap;
    const next: Win = ev.shiftKey ? [w.s, Math.max(w.s + 1, w.e + d)] : [Math.max(0, w.s + d), Math.min(NDAYS, w.e + d)];
    commit(r, prevOf(r), next, false);
  };

  const X = (n: number) => n * ppd;
  const level = ppd >= 20 ? 'Days' : ppd >= 7 ? 'Weeks' : 'Months';
  const ruler: React.ReactNode[] = [];
  if (ppd) {
    for (let n = 0; n <= NDAYS; n++) {
      const d = new Date(W0 + n * DAY);
      if (d.getUTCDate() === 1)
        ruler.push(
          <span key={`m${n}`} className="mo" style={{ left: X(n) }}>
            {MON[d.getUTCMonth()]} {d.getUTCFullYear()}
          </span>,
        );
      if (level === 'Days')
        ruler.push(
          <span key={`t${n}`} className="tk" style={{ left: X(n) + ppd / 2 }}>
            {d.getUTCDate()}
          </span>,
        );
      else if (level === 'Weeks' && d.getUTCDay() === 1)
        ruler.push(
          <span key={`t${n}`} className="tk" style={{ left: X(n) }}>
            {d.getUTCDate()} {MON[d.getUTCMonth()]}
          </span>,
        );
      else if (level === 'Months' && d.getUTCDate() === 15)
        ruler.push(
          <span key={`t${n}`} className="tk" style={{ left: X(n) }}>
            15
          </span>,
        );
    }
  }
  const line = level === 'Months' ? ppd * 7 : ppd;
  const zval = ppd && fitP > minP ? Math.round((Math.log(ppd / minP) / Math.log(ZMAX / minP)) * 1000) : 0;
  const todayN = dayN(today);

  return (
    <div className="tlv">
      <div className="tlv-tools">
        <button type="button" className="btn btn-o btn-s" disabled={!histN} onClick={undo}>
          ↶ Undo
        </button>
        <span className="hint">Drag a filing window to move it · drag its edges to resize · snaps to {snap === 7 ? 'weeks' : 'days'} · ctrl + scroll or pinch to zoom</span>
        <span className="tlv-z" role="group" aria-label="Zoom the timeline">
          <button type="button" aria-label="Zoom out" disabled={ppd <= minP + 0.01} onClick={() => zoomTo(ppd / 1.5)}>
            −
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            aria-label="Zoom level"
            value={zval}
            onChange={(e) => zoomTo(minP * Math.pow(ZMAX / minP, Number(e.target.value) / 1000))}
          />
          <button type="button" aria-label="Zoom in" disabled={ppd >= ZMAX - 0.01} onClick={() => zoomTo(ppd * 1.5)}>
            +
          </button>
          <span className="lv">{level}</span>
          <button
            type="button"
            className="fit"
            onClick={() => {
              const fitted = Math.abs(ppd - fitP) < 0.01;
              zoomTo(fitP, undefined, anchorDay);
              zoomed.current = false;
              if (fitted) toast(`Timeline fitted to the screen · from ${MONTHS[new Date(W0 + anchorDay * DAY).getUTCMonth()]}`);
            }}
          >
            Fit
          </button>
        </span>
      </div>
      <div className="tlv-g">
        <div className="tlv-n">
          <div className="sp" />
          {lanes.map((l, i) =>
            'ar' in l || 'grp' in l ? (
              <div key={i} className="ar">
                {'ar' in l ? AREA_LABEL[l.ar] : l.grp}
              </div>
            ) : (
              <div key={i} title={l.name}>
                {l.name}
              </div>
            ),
          )}
        </div>
        <div
          className={`tlv-vp${panning ? ' pan' : ''}`}
          ref={vp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div className="tlv-w" style={{ width: X(NDAYS) }}>
            <div className="tlv-r">{ruler}</div>
            {lanes.map((l, li) =>
              'ar' in l || 'grp' in l ? (
                <div key={li} className="tlv-l ar" />
              ) : (
                <div
                  key={li}
                  className="tlv-l"
                  style={
                    line > 0
                      ? { backgroundImage: `repeating-linear-gradient(to right,transparent 0,transparent ${line - 1}px,var(--hair) ${line - 1}px,var(--hair) ${line}px)` }
                      : undefined
                  }
                >
                  {l.items.map((r) => {
                    const { s: ws, e: we, due, set } = winOf(r);
                    const st = statusOf(r, today);
                    const late = we > due && !r.filedOn;
                    const col = r.filedOn ? 'var(--ok-mid)' : STC[st];
                    const task = isTaskRow(r);
                    const tip = task
                      ? `${r.name} · ${taskHint(r.task)} · ends ${nStr(due)}${r.filedOn ? ' · done' : ''}`
                      : `${r.name} · ${r.period} · window ${nStr(ws)} – ${nStr(we)} · due ${nStr(due)}${r.filedOn ? ' · filed' : late ? ` · ends ${we - due} d after the due date` : ''}`;
                    return (
                      <span key={r.id}>
                        <span
                          className={`tlv-b${late ? ' late' : ''}${r.filedOn ? ' lock' : ''}${task ? ` task${r.filedOn ? ' done' : ''}` : ''}${dragId === r.id ? ' drag' : ''}`}
                          role="slider"
                          tabIndex={0}
                          aria-label={tip}
                          aria-valuetext={`${nStr(ws)} – ${nStr(we)}`}
                          aria-valuenow={ws}
                          data-tip={dragId ? undefined : tip}
                          data-set={set ? '' : undefined}
                          style={{ left: X(ws), width: Math.max(6, X(we - ws)), background: col }}
                          onPointerDown={(e) => barDown(e, r)}
                          onPointerMove={barMove}
                          onPointerUp={() => barUp(r)}
                          onPointerCancel={() => {
                            drag.current = null;
                            setRead(null);
                            setDragId(null);
                          }}
                          onKeyDown={(ev) => barKey(ev, r)}
                        >
                          {r.filedOn || task ? null : (
                            <>
                              <span className="hd l" data-h="l" />
                              <span className="hd r" data-h="r" />
                            </>
                          )}
                        </span>
                        <span className="tlv-d" style={{ left: X(due), background: late ? 'oklch(var(--danger))' : 'oklch(var(--brand))' }} />
                      </span>
                    );
                  })}
                </div>
              ),
            )}
            {todayN >= 0 && todayN <= NDAYS ? <span className="tlv-today" style={{ left: X(todayN) }} /> : null}
          </div>
        </div>
      </div>
      {read ? (
        <div className="tlv-read" style={{ left: read.x, top: read.y }}>
          {read.t}
        </div>
      ) : null}
    </div>
  );
}
