'use client';

/**
 * Live timeline editor — React port of prototype final-src/tl-editor.js
 * (opened by "Edit" on the Home Timeline card), in CLIENT mode: the client
 * drags / resizes phases (day or week snap), later phases cascade, Undo (60
 * steps), Reset, zoom (− / slider / + / Fit, ctrl + wheel, pinch, drag-to-pan),
 * before / after compare and a reason; "Send request" stores a timeline change
 * request (POST /api/client/change-requests, kind 'timeline') that the Project
 * Manager approves. The info strip and change table come from the
 * v7p_timeline_client board. The mode is the user's role (no toggle): the
 * client portal only ever edits as the client.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortal } from '@/components/client-portal/PortalProvider';
import type { TimelinePhaseDates } from '@/lib/client/client-home';
import { HOME_QUERY_KEY } from './useHome';
import { addDays, days, dShort, solid, type TlPhase } from './derive';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ZMAX = 48;

type P = { id: TlPhase['id']; name: string; s: number; e: number; done?: boolean; ms?: boolean; color: string };

export function TimelineEditor({
  phases,
  today,
  engagementId,
  company,
  manager,
  onClose,
}: {
  phases: TlPhase[];
  today: string;
  engagementId: string;
  company: string;
  manager?: string;
  onClose: () => void;
}) {
  const { toast } = usePortal();
  const qc = useQueryClient();
  const T0 = phases[0]!.from;
  const coiBase = phases[3]!.from;
  const SPAN = Math.max(14, days(T0, [coiBase, today].sort().at(-1)!) + 11);
  const W0 = -42;
  const W1 = SPAN + 53;
  const TODAY = days(T0, today);
  const base = useMemo<P[]>(
    () =>
      phases.map((p) => ({
        id: p.id,
        name: p.name,
        s: days(T0, p.from),
        e: days(T0, p.to),
        done: p.done,
        ms: p.milestone,
        color: p.id === 'p1' ? 'var(--ok,#1f9d7a)' : p.id === 'p2' ? 'var(--navy-3,#1b4f94)' : p.id === 'mca' ? 'oklch(70% .03 255)' : 'var(--gold,#c9a24b)',
      })),
    [phases, T0],
  );
  const d2s = useCallback((n: number) => dShort(addDays(T0, n)), [T0]);
  const [ph, setPh] = useState<P[]>(() => base.map((p) => ({ ...p })));
  const [hist, setHist] = useState<P[][]>([]);
  const phRef = useRef(ph);
  phRef.current = ph;
  const [on, setOn] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const vpRef = useRef<HTMLDivElement>(null);
  const [vpW, setVpW] = useState(700);
  const [ppd, setPpd] = useState<number | null>(null);
  const [dragI, setDragI] = useState<number | null>(null);
  const [kbI, setKbI] = useState<number | null>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const minPpd = vpW / (W1 - W0);
  const fitPpd = Math.max(minPpd, Math.min(ZMAX, vpW / SPAN));
  const z = ppd ?? fitPpd;
  const X = (n: number) => (n - W0) * z;
  const snap = z < 8 ? 7 : 1;
  const level = z >= 22 ? 'Days' : z >= 8 ? 'Weeks' : 'Months';

  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVpW(el.clientWidth || 700));
    ro.observe(el);
    setVpW(el.clientWidth || 700);
    return () => ro.disconnect();
  }, []);
  // first layout: scroll so the axis origin is at the left edge
  const placed = useRef(false);
  useEffect(() => {
    if (placed.current || !vpRef.current || vpW === 700) return;
    placed.current = true;
    vpRef.current.scrollLeft = (0 - W0) * fitPpd - 4;
  }, [vpW, fitPpd, W0]);

  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    const t = setTimeout(() => (document.querySelector('#tle .bar:not(.lock)') as HTMLElement | null)?.focus({ preventScroll: true }), 60);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, []);
  const close = useCallback(() => {
    setOn(false);
    setTimeout(onClose, reduce ? 0 : 180);
  }, [onClose, reduce]);
  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [close]);

  const push = () => setHist((h) => [...h.slice(-59), phRef.current.map((p) => ({ ...p }))]);
  const undo = () => {
    if (!hist.length) return toast('Nothing to undo');
    setPh(hist[hist.length - 1]!);
    setHist((h) => h.slice(0, -1));
  };

  /** cascade: a phase never starts before the previous one ends; later phases keep their gaps */
  const apply = (src: P[], i: number, ns: number, ne: number, mode: 'move' | 'start' | 'end'): P[] => {
    const a = src.map((p) => ({ ...p }));
    const p = a[i]!;
    if (p.done) return a;
    const minS = i ? a[i - 1]!.e : W0;
    if (p.ms) {
      ns = Math.max(minS, Math.min(W1, ns));
      ne = ns;
    } else {
      ns = Math.max(minS, ns);
      ne = Math.max(ns + 1, Math.min(W1, ne));
      if (mode === 'move') {
        const w = p.e - p.s;
        ne = Math.min(W1, ns + w);
        ns = ne - w;
      }
    }
    const shift = ne - p.e;
    p.s = ns;
    p.e = ne;
    for (let j = i + 1; j < a.length; j++) {
      const q = a[j]!;
      const prev = a[j - 1]!;
      if (shift > 0 || q.s > prev.e) {
        const w2 = q.e - q.s;
        q.s = Math.max(prev.e, q.s + shift);
        q.e = Math.min(W1, q.s + w2);
        if (q.ms) q.e = q.s;
      }
      if (q.s < prev.e) {
        const w3 = q.e - q.s;
        q.s = prev.e;
        q.e = q.s + w3;
      }
    }
    return a;
  };

  const startDrag = (e: RPointerEvent<HTMLSpanElement>, i: number) => {
    e.stopPropagation();
    const p = phRef.current[i]!;
    if (p.done) {
      toast(`${p.name.split(' · ')[0]} is done, so its dates are locked`);
      return;
    }
    e.preventDefault();
    const bar = e.currentTarget;
    bar.focus({ preventScroll: true });
    const h = (e.target as HTMLElement).closest('.hd');
    const mode = h ? (h.getAttribute('data-h') === 'l' ? 'start' : 'end') : 'move';
    const x0 = e.clientX;
    const s0 = p.s;
    const e0 = p.e;
    const start = phRef.current;
    let moved = false;
    const sn = snap;
    const zz = z;
    push();
    setDragI(i);
    bar.setPointerCapture?.(e.pointerId);
    const mv = (ev: PointerEvent) => {
      const dd = Math.round((ev.clientX - x0) / zz / sn) * sn;
      if (dd) moved = true;
      setPh(
        mode === 'move'
          ? apply(start, i, s0 + dd, e0 + dd, 'move')
          : mode === 'start'
            ? apply(start, i, Math.min(e0 - 1, s0 + dd), e0, 'start')
            : apply(start, i, s0, Math.max(s0 + 1, e0 + dd), 'end'),
      );
    };
    const up = () => {
      setDragI(null);
      bar.removeEventListener('pointermove', mv);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      if (!moved) setHist((hh) => hh.slice(0, -1));
    };
    bar.addEventListener('pointermove', mv);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const p = ph[i]!;
    if (p.done) return toast(`${p.name.split(' · ')[0]} is done, so its dates are locked`);
    const d = (e.key === 'ArrowRight' ? 1 : -1) * snap;
    push();
    setPh(e.shiftKey && !p.ms ? apply(ph, i, p.s, p.e + d, 'end') : apply(ph, i, p.s + d, p.e + d, 'move'));
  };

  /* zoom keeping the date under the anchor still */
  const zoomTo = useCallback(
    (np: number, anchorPx?: number, anchorDay?: number) => {
      const vp = vpRef.current;
      if (!vp) return;
      np = Math.max(minPpd, Math.min(ZMAX, np));
      const ax = anchorPx ?? vp.clientWidth / 2;
      const dayAt = anchorDay ?? (vp.scrollLeft + ax) / z + W0;
      setPpd(np);
      requestAnimationFrame(() => {
        vp.scrollLeft = anchorDay != null ? (anchorDay - W0) * np - 4 : (dayAt - W0) * np - ax;
      });
    },
    [minPpd, z, W0],
  );
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = vp.getBoundingClientRect();
        zoomTo(z * Math.exp(-e.deltaY * 0.01), e.clientX - r.left);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && z > fitPpd + 0.5) {
        e.preventDefault();
        vp.scrollLeft += e.deltaY;
      }
    };
    vp.addEventListener('wheel', wheel, { passive: false });
    return () => vp.removeEventListener('wheel', wheel);
  }, [z, fitPpd, zoomTo]);
  const pts = useRef<Record<number, number>>({});
  const pinch = useRef<{ d: number; p: number; mid: number } | null>(null);
  const pan = useRef<{ x: number; s: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const vpDown = (e: RPointerEvent<HTMLDivElement>) => {
    const vp = vpRef.current!;
    pts.current[e.pointerId] = e.clientX;
    const ids = Object.keys(pts.current);
    if (ids.length === 2) {
      const a = pts.current[+ids[0]!]!;
      const b = pts.current[+ids[1]!]!;
      const r = vp.getBoundingClientRect();
      pinch.current = { d: Math.abs(a - b) || 1, p: z, mid: (a + b) / 2 - r.left };
      pan.current = null;
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 0) {
      pan.current = { x: e.clientX, s: vp.scrollLeft };
      setPanning(true);
      vp.setPointerCapture?.(e.pointerId);
    }
  };
  const vpMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (pts.current[e.pointerId] != null) pts.current[e.pointerId] = e.clientX;
    const ids = Object.keys(pts.current);
    if (pinch.current && ids.length === 2) {
      const d = Math.abs(pts.current[+ids[0]!]! - pts.current[+ids[1]!]!) || 1;
      zoomTo((pinch.current.p * d) / pinch.current.d, pinch.current.mid);
      return;
    }
    if (pan.current && vpRef.current) vpRef.current.scrollLeft = pan.current.s - (e.clientX - pan.current.x);
  };
  const vpEnd = (e: RPointerEvent<HTMLDivElement>) => {
    delete pts.current[e.pointerId];
    if (Object.keys(pts.current).length < 2) pinch.current = null;
    if (pan.current) {
      pan.current = null;
      setPanning(false);
    }
  };

  /* ruler */
  const ruler = useMemo(() => {
    const out: { k: string; cls: string; left: number; text: string }[] = [];
    for (let n = W0; n <= W1; n++) {
      const iso = addDays(T0, n);
      const d = new Date(`${iso}T00:00:00Z`);
      const x = (n - W0) * z;
      if (d.getUTCDate() === 1 || n === W0) out.push({ k: `m${n}`, cls: 'mo', left: x, text: `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
      if (level === 'Days') out.push({ k: `d${n}`, cls: `tk${d.getUTCDay() % 6 === 0 ? ' we' : ''}`, left: x + z / 2, text: `${z >= 34 ? `${DOW[d.getUTCDay()]!.slice(0, 2)} ` : ''}${d.getUTCDate()}` });
      else if (level === 'Weeks' && d.getUTCDay() === 1) out.push({ k: `w${n}`, cls: 'tk', left: x, text: `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` });
      else if (level === 'Months' && d.getUTCDay() === 1 && z * 7 >= 30) out.push({ k: `w${n}`, cls: 'tk we', left: x, text: String(d.getUTCDate()) });
    }
    return out;
  }, [W0, W1, T0, z, level]);
  const lineW = level === 'Months' ? z * 7 : z;
  const dow0 = new Date(`${addDays(T0, W0)}T00:00:00Z`).getUTCDay();
  const startShift = level === 'Months' ? (((1 - dow0) + 7) % 7) * z : 0;
  const laneBg = { backgroundImage: `repeating-linear-gradient(to right,transparent 0,transparent ${lineW - 1}px,#eef1f5 ${lineW - 1}px,#eef1f5 ${lineW}px)`, backgroundPosition: `${startShift}px 0` };
  const sliderVal = Math.round((Math.log(z / minPpd) / Math.log(ZMAX / minPpd)) * 1000);

  const coi = ph[3]!.s;
  const coi0 = base[3]!.s;
  const slip = coi - coi0;
  const cls = slip > 0 ? 'late' : slip < 0 ? 'early' : 'same';
  const msg = slip > 0 ? `Slipped by ${slip} day${slip > 1 ? 's' : ''}` : slip < 0 ? `Pulled in by ${-slip} day${slip < -1 ? 's' : ''}` : 'No change to the COI date';
  const range = (p: P) => (p.ms ? d2s(p.s) : `${d2s(p.s)} – ${d2s(p.e)}`);
  const changed = ph.some((p, i) => p.s !== base[i]!.s || p.e !== base[i]!.e);
  const mgr = manager ?? 'the project manager';

  const commit = async () => {
    if (!changed) {
      toast('No changes to save');
      return;
    }
    if (!reason.trim()) {
      setErr(true);
      (document.getElementById('tle-reason') as HTMLTextAreaElement | null)?.focus();
      return;
    }
    setBusy(true);
    const payload: TimelinePhaseDates[] = ph.map((p) => ({ id: p.id, name: p.name, from: addDays(T0, p.s), to: addDays(T0, p.e) }));
    const res = await fetch('/api/client/change-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'timeline', engagementId, note: reason.trim(), phases: payload, coiBefore: addDays(T0, coi0) }),
    }).catch(() => null);
    setBusy(false);
    const body = (await res?.json().catch(() => ({}))) as { request?: { id: string }; error?: string } | undefined;
    if (!res?.ok || !body?.request) {
      toast(body?.error ?? 'Could not send the request. Try again.');
      return;
    }
    const id = body.request.id;
    void qc.invalidateQueries({ queryKey: [HOME_QUERY_KEY] });
    close();
    toast(`Change request sent to ${mgr}`, {
      undo: () => {
        void fetch(`/api/client/change-requests/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => qc.invalidateQueries({ queryKey: [HOME_QUERY_KEY] }));
      },
    });
  };

  const rows = ph.map((p, i) => ({ p, b0: base[i]! }));
  return (
    <div id="tle-scrim" className={on ? 'on' : undefined} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div id="tle" role="dialog" aria-modal="true" aria-labelledby="tle-t">
        <div className="h">
          <h2 id="tle-t">Request a timeline change</h2>
          <button type="button" className="x" aria-label="Close editor" onClick={close}>
            ×
          </button>
        </div>
        <div className="tools">
          <button type="button" className="btn" aria-label="Undo last change" disabled={!hist.length} onClick={undo}>
            ↶ Undo
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              push();
              setPh(base.map((p) => ({ ...p })));
              toast('Reset to the saved timeline');
            }}
          >
            Reset
          </button>
          <span className="hint">Drag a bar to move it · drag its edges to change dates · snaps to {snap === 7 ? 'weeks' : 'days'} · ctrl + scroll or pinch to zoom</span>
          <span className="zoom" role="group" aria-label="Zoom the timeline">
            <button type="button" aria-label="Zoom out" disabled={z <= minPpd + 0.01} onClick={() => zoomTo(z / 1.5)}>
              −
            </button>
            <input type="range" min={0} max={1000} aria-label="Zoom level" value={Number.isFinite(sliderVal) ? sliderVal : 0} onChange={(e) => zoomTo(minPpd * Math.pow(ZMAX / minPpd, Number(e.target.value) / 1000))} />
            <button type="button" aria-label="Zoom in" disabled={z >= ZMAX - 0.01} onClick={() => zoomTo(z * 1.5)}>
              +
            </button>
            <span className="lv">{level}</span>
            <button type="button" className="fit" onClick={() => zoomTo(fitPpd, undefined, 0)}>
              Fit
            </button>
          </span>
        </div>
        <div className="grid">
          <div className="col-n">
            <div className="sp" />
            {rows.map(({ p }) => (
              <div key={p.id}>
                <span className="n" style={{ display: 'flex' }}>
                  {p.done ? <span aria-label="Done · locked">🔒</span> : null}
                  {p.name}
                </span>
              </div>
            ))}
          </div>
          <div className={`vp${panning ? ' pan' : ''}`} ref={vpRef} onPointerDown={vpDown} onPointerMove={vpMove} onPointerUp={vpEnd} onPointerCancel={vpEnd} onPointerLeave={(e) => e.pointerType !== 'mouse' && vpEnd(e)}>
            <div className="world" style={{ width: (W1 - W0) * z }}>
              <div className="ruler">
                {ruler.map((r) => (
                  <span key={r.k} className={r.cls} style={{ left: r.left }}>
                    {r.text}
                  </span>
                ))}
              </div>
              <div className="lanes">
                {rows.map(({ p, b0 }, i) => {
                  const read = p.ms ? d2s(p.s) : `${d2s(p.s)} – ${d2s(p.e)} · ${p.e - p.s} days`;
                  const moved = b0.s !== p.s || b0.e !== p.e;
                  return (
                    <div key={p.id} className="lane" style={laneBg}>
                      <span className="ghost" style={{ left: X(b0.s), width: b0.ms ? 18 : Math.max(1, b0.e - b0.s) * z, display: moved ? undefined : 'none', marginLeft: b0.ms ? -9 : undefined }} />
                      <span
                        className={`bar${p.done ? ' lock' : ''}${p.ms ? ' ms' : ''}${dragI === i ? ' drag' : ''}${kbI === i ? ' kb' : ''}`}
                        role="slider"
                        tabIndex={0}
                        aria-label={p.name}
                        aria-valuetext={read}
                        aria-valuenow={p.s}
                        style={{ background: p.color, left: X(p.s), width: p.ms ? undefined : Math.max(1, p.e - p.s) * z }}
                        onPointerDown={(e) => startDrag(e, i)}
                        onKeyDown={(e) => {
                          if (/^Arrow/.test(e.key)) setKbI(i);
                          onKey(e, i);
                        }}
                        onBlur={() => setKbI((k) => (k === i ? null : k))}
                      >
                        <span className="hd l" data-h="l" aria-hidden="true" />
                        <span className="hd r" data-h="r" aria-hidden="true" />
                        <span className="read">{read}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <span className="today" style={{ left: X(TODAY) }} data-today={`Today ${dShort(today)}`} />
            </div>
          </div>
          <div className="col-d">
            <div className="sp" />
            {rows.map(({ p, b0 }) => {
              const dd = p.e - b0.e;
              return (
                <div key={p.id} className="row">
                  <span className="d">
                    <b>{range(p)}</b>
                    {dd ? <span className={`chg ${dd > 0 ? 'late' : 'early'}`}>{`${dd > 0 ? '+' : ''}${dd} d`}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sum">
          <span className="big">
            COI {d2s(coi0)}
            {slip ? ` → ${d2s(coi)}` : ''}
          </span>
          <span className={`pill ${cls}`}>{msg}</span>
          {slip > 0 ? <span className="hint">MCA review and the COI move with Phase 2. {company} is told by email and WhatsApp once it is approved.</span> : null}
        </div>
        {changed ? (
          <table className="chgt">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Before</th>
                <th>After</th>
                <th style={{ textAlign: 'right' }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(({ p, b0 }) => p.s !== b0.s || p.e !== b0.e)
                .map(({ p, b0 }) => {
                  const dd = p.e - b0.e;
                  const ds = p.s - b0.s;
                  return (
                    <tr key={p.id}>
                      <td className="rt" style={{ padding: '7px 8px' }}>{p.name}</td>
                      <td className="mono" style={{ padding: '7px 8px', fontSize: 12, color: 'var(--muted)', textDecoration: 'line-through' }}>{range(b0)}</td>
                      <td className="mono" style={{ padding: '7px 8px', fontSize: 12, fontWeight: 600 }}>{range(p)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                        <span className="chip" style={dd > 0 ? solid('over') : solid('ok')}>
                          {ds === dd && !p.ms && p.id !== 'p2' ? `moved ${dd > 0 ? '+' : ''}${dd}` : `${dd > 0 ? '+' : ''}${dd} days`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        ) : null}
        <div className="cmp">
          <div>
            <h4>Before</h4>
            <ul>
              {base.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <b>{range(p)}</b>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>After</h4>
            <ul>
              {ph.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <b>{range(p)}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="client">
          <label htmlFor="tle-reason">Why do you need this change?</label>
          <textarea
            id="tle-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setErr(false);
            }}
            placeholder="For example: our director is travelling until 14 Oct, so the KYC video call has to move."
          />
          <div className="err" style={{ display: err ? 'block' : 'none' }} role="alert">
            Add a short reason so {company}’s project manager can approve it.
          </div>
        </div>
        <div className="f">
          <span className="warn">
            {mgr} (Project Manager) approves requests. {company}’s dates stay as they are until then.
          </span>
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="button" className="btn n" disabled={busy} onClick={() => void commit()}>
            Send request
          </button>
        </div>
      </div>
    </div>
  );
}
