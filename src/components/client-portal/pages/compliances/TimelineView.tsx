'use client';

/**
 * Timeline view (T-01…T-14; cal-views.js timelineView()): a Gantt strip of
 * filing windows over the FY, lanes by area then filing, zoomable ruler
 * (− / slider / + / Fit, ctrl/⌘+wheel, pinch), drag-to-pan, red Today line.
 *
 * READ-ONLY for clients (owner rule: only managers write windows): bars do not
 * drag; click / Enter opens the filing. Windows come from
 * compliance_instances.window_from/to, else due − PREP days.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePortal } from '../../PortalProvider';
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

const DAY = 86_400_000;
const ZMAX = 40;
const PREP: Record<string, number> = { monthly: 5, quarterly: 10, 'half-yearly': 10, annual: 21 };
const STC: Record<CompStatus, string> = { ok: 'var(--ok)', due: 'var(--due)', over: 'var(--over)', up: 'var(--navy)' };

type Lane = { ar: AreaCode } | { name: string; items: PortalFiling[] };

export function TimelineView({ fyStart, rows, today, onOpen }: { fyStart: number; rows: PortalFiling[]; today: string; onOpen: (f: PortalFiling) => void }) {
  const { toast } = usePortal();
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
      const inA = inRange.filter((r) => r.area === a);
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
        <span className="hint">Filing windows are set by SBC · drag to pan · ctrl + scroll or pinch to zoom</span>
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
            'ar' in l ? (
              <div key={i} className="ar">
                {AREA_LABEL[l.ar]}
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
              'ar' in l ? (
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
                    const due = dayN(r.dueDate);
                    const set = Boolean(r.windowFrom && r.windowTo);
                    const s = set ? dayN(r.windowFrom!) : due - (PREP[r.frequency.toLowerCase()] ?? 5);
                    const e = set ? dayN(r.windowTo!) : due;
                    const st = statusOf(r, today);
                    const late = e > due && !r.filedOn;
                    const col = r.filedOn ? 'var(--ok)' : STC[st];
                    const tip = `${r.name} · ${r.period} · window ${nStr(s)} – ${nStr(e)} · due ${nStr(due)}${r.filedOn ? ' · filed' : late ? ` · ends ${e - due} d after the due date` : ''}${set ? ' · set by SBC' : ''}`;
                    return (
                      <span key={r.id}>
                        <span
                          className={`tlv-b ro${late ? ' late' : ''}${r.filedOn ? ' lock' : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-label={tip}
                          data-tip={tip}
                          style={{ left: X(s), width: Math.max(6, X(e - s)), background: col }}
                          onClick={() => onOpen(r)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              onOpen(r);
                            }
                          }}
                        />
                        <span className="tlv-d" style={{ left: X(due), background: late ? 'var(--over)' : 'var(--navy)' }} />
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
    </div>
  );
}
