'use client';

/**
 * Intro / splash (owner change 2) — the three-card reveal into "VCFO Suite by
 * SBC", ported from prototype `final-src/outer-shell.html` (`#vi`). The timing
 * math (7.0 s timeline, fade from 6.4 s, 50 ms frame-clock cap, wide / square
 * layouts, small-screen start scale) is kept verbatim.
 *
 * Shown ONCE per client: it plays when the portal shell has loaded and
 * `prefs.introSeen` is false, then `savePrefs({ introSeen: true })`
 * (client_portal_prefs.intro_seen_at). Never shown when
 * localStorage `vcfo.skipIntro` is '1' (I-07) or under prefers-reduced-motion
 * (skipped instantly, still marked seen). The app underneath is `inert` +
 * `aria-hidden` until the intro leaves; Skip / Esc jump to the finished logo.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePortal } from './PortalProvider';
import './css/credentials-intro.css';

const PLAYED_KEY = 'vcfo.introPlayed';
/** This browser already knows the intro was seen (mirrors prefs.introSeen), so no cover is needed while prefs load. */
const SEEN_KEY = 'vcfo.introSeen';

/** Could the intro play here, before prefs are known? */
function mayPlay(): boolean {
  try {
    if (localStorage.getItem('vcfo.skipIntro') === '1' || localStorage.getItem(SEEN_KEY) === '1' || sessionStorage.getItem(PLAYED_KEY) === '1') return false;
  } catch {
    /* private mode */
  }
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch {
    /* old browser */
  }
  return true;
}

export function PortalIntro() {
  const { prefs, shell, savePrefs } = usePortal();
  const [show, setShow] = useState(false);
  /* SH-17: the prototype intro starts on a white stage at load — cover the app while prefs load
     when the intro may play, so the dashboard never flashes before it */
  const [cover, setCover] = useState(false);
  const decided = useRef(false);

  useLayoutEffect(() => {
    if (!decided.current && !prefs && mayPlay()) setCover(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, []);

  useEffect(() => {
    if (decided.current || !shell || !prefs) return;
    decided.current = true;
    setCover(false);
    if (prefs.introSeen) {
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* private mode */
      }
      return;
    }
    let off = false;
    try {
      off = localStorage.getItem('vcfo.skipIntro') === '1' || sessionStorage.getItem(PLAYED_KEY) === '1';
    } catch {
      /* private mode */
    }
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* old browser */
    }
    if (off) return;
    if (reduce) {
      savePrefs({ introSeen: true });
      return;
    }
    setShow(true);
  }, [shell, prefs, savePrefs]);

  if (!show)
    return cover ? (
      <div className="cp-intro" aria-hidden="true">
        <div id="vi" />
      </div>
    ) : null;
  return (
    <IntroStage
      onDone={() => {
        try {
          sessionStorage.setItem(PLAYED_KEY, '1');
          localStorage.setItem(SEEN_KEY, '1');
        } catch {
          /* private mode */
        }
        savePrefs({ introSeen: true });
      }}
      onGone={() => setShow(false)}
    />
  );
}

function IntroStage({ onDone, onGone }: { onDone: () => void; onGone: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onDone, onGone });
  cb.current = { onDone, onGone };

  useEffect(() => {
    const host = hostRef.current;
    const I = host?.querySelector<HTMLDivElement>('#vi');
    if (!host || !I) return;

    /* the app under the intro is inert until it leaves */
    const siblings = Array.from(host.parentElement?.children ?? []).filter((el) => el !== host) as HTMLElement[];
    const prevAria = siblings.map((el) => el.getAttribute('aria-hidden'));
    siblings.forEach((el) => {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    });
    const restoreApp = () =>
      siblings.forEach((el, i) => {
        el.removeAttribute('inert');
        const a = prevAria[i];
        if (a == null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', a);
      });

    const DUR = 7.0;
    const END = 6.4; // the artifact's 7 s timeline; the fade starts at 6.4 s so the app is showing by ~7 s
    // Card shape from the sketch (units): each card is 215 wide, the next one 37 right and 62 taller.
    const W = 215;
    const DX = 37;
    const DH = 62;
    const LH = 75;
    const RISE = 135;
    const FULL = LH + RISE + 2 * DH;
    const MARK_H = 220;
    const K = MARK_H / FULL;
    const MARK_W = (W + 2 * DX) * K;
    const NAME_FS = 15;
    const $ = <T extends Element = SVGElement>(id: string) => I.querySelector<T>(`#vi-${id}`)!;
    const svg = $<SVGSVGElement>('svg');
    const stack = $('stack');
    const skipBtn = $<HTMLButtonElement>('skip');
    const cards = [0, 1, 2].map((i) => $(`card${i}`));
    const names = Array.from(I.querySelectorAll<SVGTextElement>('.cname'));
    const vClipRect = $('vClipRect');
    const wordClipRect = $('wordClipRect');
    const wordText = $('wordText');
    const byline = $('byline');
    const byText = $('byText');
    const sbc = $('sbc');

    const GEO = [0, 1, 2].map((i) => {
      const n = 2 - i;
      const x0 = DX * n * K;
      const lh = (LH + DH * n) * K;
      const rh = (LH + RISE + DH * n) * K;
      const w = W * K;
      return { x0, w, lh, rh, cx: x0 + w / 2 };
    });
    GEO.forEach((g, i) => {
      cards[i]!.querySelector('.shape')!.setAttribute('points', `${g.x0},0 ${g.x0},${-g.lh} ${g.x0 + g.w},${-g.rh} ${g.x0 + g.w},0`);
      const t = names[i]!;
      t.setAttribute('x', String(g.cx));
      t.setAttribute('y', (-Math.min(g.lh, 60) * 0.55).toFixed(1));
      t.setAttribute('font-size', String(NAME_FS));
    });
    const F = GEO[2]!;
    const vee = $('vee');
    const vx = F.x0 + F.w * 0.52;
    const vbase = -22 * K;
    const vsize = 115 * K;
    vee.setAttribute('x', String(vx));
    vee.setAttribute('y', String(vbase));
    vee.setAttribute('font-size', String(vsize));
    vClipRect.setAttribute('x', String(vx - vsize));
    vClipRect.setAttribute('width', String(vsize * 2));

    // wide = the artifact's wide format (landscape screens); square = its square format (portrait screens).
    type Layout = { vb: number[]; cx: number; cy: number; fs: number; fo: number[]; wx: number; wy: number; by: number; anchor: 'start' | 'middle'; s1: number };
    const LAYOUTS: Record<'wide' | 'square', Layout> = {
      wide: { vb: [72, 50, 1000, 400], cx: 600, cy: 250, fs: 0.72, fo: [220, 340], wx: 371, wy: 287, by: 327, anchor: 'start', s1: 1.55 },
      square: { vb: [40, 160, 720, 540], cx: 400, cy: 400, fs: 0.9, fo: [400 - MARK_W * 0.45, 440], wx: 400, wy: 570, by: 616, anchor: 'middle', s1: 1.8 },
    };
    let L: Layout | null = null;
    let s0 = 1;
    let cur = 0;

    const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const easeBack = (x: number) => {
      const c1 = 1.4;
      const c3 = c1 + 1;
      return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };
    const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

    function renderAt(t: number) {
      if (!L) return;
      cur = t;
      // on small screens the cards start larger so their names stay readable (>= 11.5 px), then settle into the logo
      const gx = L.cx - (MARK_W * s0) / 2;
      const gy = L.cy + (MARK_H * s0) / 2;
      const mv = easeInOut(seg(t, 3.7, 4.5));
      const sc = lerp(s0, L.fs, mv);
      const ox = lerp(gx, L.fo[0]!, mv);
      const oy = lerp(gy, L.fo[1]!, mv);
      const pulse = 1 + Math.sin(Math.PI * seg(t, 3.15, 3.6)) * 0.04;
      stack.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${(sc * pulse).toFixed(4)})`);
      // A · Build up: each card grows up from the baseline like a rising bar, one stage after another
      const arr: number[] = [];
      for (let i = 0; i < 3; i++) {
        const a = 0.35 + i * 0.7;
        const p = seg(t, a, a + 0.75);
        cards[i]!.setAttribute('transform', `scale(1 ${Math.max(0.001, easeBack(p)).toFixed(4)})`);
        cards[i]!.setAttribute('opacity', clamp(p * 8).toFixed(3));
        arr.push(easeOut(p));
      }
      const nameFade = 1 - seg(t, 2.85, 3.1);
      for (let j = 0; j < 3; j++) {
        const shown = clamp(seg(t, 0.35 + j * 0.5, 0.75 + j * 0.5) * 3);
        const covered = j < 2 ? arr[j + 1]! : 0;
        names[j]!.setAttribute('opacity', (nameFade * (1 - covered) * Math.min(1, shown)).toFixed(3));
      }
      const vp = easeOut(seg(t, 3.05, 3.5));
      vClipRect.setAttribute('y', (vbase - vsize).toFixed(2));
      vClipRect.setAttribute('height', (vsize * 1.1 * vp).toFixed(2));
      const wp = easeInOut(seg(t, 4.1, 5.0));
      const ww = 640 * wp;
      wordClipRect.setAttribute('x', L.anchor === 'middle' ? (L.wx - ww / 2).toFixed(2) : String(L.wx - 10));
      wordClipRect.setAttribute('width', (wp > 0 ? ww + 20 : 0).toFixed(2));
      const bp = easeOut(seg(t, 4.8, 5.4));
      byline.setAttribute('opacity', bp.toFixed(3));
      byline.setAttribute('transform', `translate(0 ${((1 - bp) * 8).toFixed(2)})`);
    }

    function setLayout() {
      const name = innerWidth / Math.max(1, innerHeight) < 1.05 ? 'square' : 'wide';
      if (!L || L !== LAYOUTS[name]) {
        L = LAYOUTS[name];
        I!.classList.remove('wide', 'square');
        I!.classList.add(name);
        svg.setAttribute('viewBox', L.vb.join(' '));
        wordText.setAttribute('x', String(L.wx));
        wordText.setAttribute('y', String(L.wy));
        wordText.setAttribute('text-anchor', L.anchor);
        const bx = L.anchor === 'middle' ? L.wx - 57 : L.wx + 6;
        byText.setAttribute('x', String(bx));
        byText.setAttribute('y', String(L.by));
        sbc.setAttribute('x', String(bx + 36));
        sbc.setAttribute('y', (L.by - 0.707 * 21.2).toFixed(2));
      }
      const r = svg.getBoundingClientRect();
      const ppu = Math.min(r.width / L.vb[2]!, r.height / L.vb[3]!) || 1; // CSS px per SVG unit
      s0 = Math.max(1, Math.min(L.s1, 11.5 / (NAME_FS * ppu)));
      renderAt(cur);
    }

    let appReady = false;
    let ended = false;
    let gone = false;
    let raf = 0;
    let last = -1;
    let t = 0;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    function fadeOut() {
      if (gone) return;
      gone = true;
      if (raf) cancelAnimationFrame(raf);
      const hadFocus = I!.contains(document.activeElement);
      restoreApp();
      I!.classList.add('out');
      cb.current.onDone();
      let done = false;
      function remove() {
        if (done) return;
        done = true;
        removeEventListener('resize', setLayout);
        document.removeEventListener('keydown', onKey);
        if (hadFocus) {
          const main = document.querySelector<HTMLElement>('.cp-page-host');
          main?.setAttribute('tabindex', '-1');
          main?.focus({ preventScroll: true });
        }
        cb.current.onGone();
      }
      I!.addEventListener('transitionend', remove, { once: true });
      timers.push(setTimeout(remove, 800));
    }
    function maybeLeave() {
      if (ended && appReady) fadeOut();
    }
    // show the finished logo; leave as soon as the first screen is ready (it almost always is by now)
    function finish() {
      if (ended) return;
      ended = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      renderAt(DUR);
      I!.classList.add('end');
      maybeLeave();
      timers.push(
        setTimeout(() => {
          appReady = true;
          maybeLeave();
        }, 12000),
      ); // never trap the user behind the intro
    }
    // frame clock: advances by real time but at most 50 ms per frame, so a busy main thread
    // (the app loading underneath) pauses the reveal instead of making it jump
    function tick(now: number) {
      if (last >= 0) t += Math.min(50, Math.max(0, now - last)) / 1000;
      last = now;
      if (t >= END) {
        finish();
        return;
      }
      renderAt(t);
      raf = requestAnimationFrame(tick);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        finish();
      }
    }

    skipBtn.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);
    addEventListener('resize', setLayout);
    setLayout();
    renderAt(0);
    try {
      void document.fonts?.load('700 20px Poppins');
      void document.fonts?.load('400 20px Poppins');
    } catch {
      /* no font loading API */
    }
    raf = requestAnimationFrame(tick);
    // "ready" = the portal shell's first data has settled (the intro mounts only after it) → +150 ms
    timers.push(
      setTimeout(() => {
        appReady = true;
        maybeLeave();
      }, 150),
    );

    return () => {
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      skipBtn.removeEventListener('click', finish);
      document.removeEventListener('keydown', onKey);
      removeEventListener('resize', setLayout);
      if (!gone) restoreApp();
    };
  }, []);

  return (
    <div className="cp-intro" ref={hostRef}>
      <div id="vi" className="wide">
        <svg id="vi-svg" viewBox="72 50 1000 400" role="img" aria-labelledby="vi-t vi-d">
          <title id="vi-t">VCFO Suite by SBC</title>
          <desc id="vi-d">
            Three sloped cards for Incorporation, Registrations and Compliances come together into one stack. A V appears on the front card, then the VCFO
            Suite by SBC name.
          </desc>
          <defs>
            <clipPath id="vi-wordClip">
              <rect id="vi-wordClipRect" x="0" y="0" width="0" height="1000" />
            </clipPath>
            <clipPath id="vi-vClip">
              <rect id="vi-vClipRect" x="0" y="0" width="0" height="0" />
            </clipPath>
          </defs>
          <g id="vi-stack">
            <g id="vi-card0" opacity="0">
              <polygon className="shape" style={{ fill: 'var(--yellow)' }} />
              <text className="cname" textAnchor="middle" fontFamily="Poppins, Segoe UI, sans-serif" fontWeight="600" fill="#3D2A00">
                Incorporation
              </text>
            </g>
            <g id="vi-card1" opacity="0">
              <polygon className="shape" style={{ fill: 'var(--orange)' }} />
              <text className="cname" textAnchor="middle" fontFamily="Poppins, Segoe UI, sans-serif" fontWeight="600" fill="#FFFFFF">
                Registrations
              </text>
            </g>
            <g id="vi-card2" opacity="0">
              <polygon className="shape" style={{ fill: 'var(--deep)' }} />
              <text className="cname" textAnchor="middle" fontFamily="Poppins, Segoe UI, sans-serif" fontWeight="600" fill="#FFFFFF">
                Compliances
              </text>
              <g clipPath="url(#vi-vClip)">
                <text id="vi-vee" textAnchor="middle" fontFamily="Poppins, Segoe UI, sans-serif" fontWeight="700" fill="#FFFFFF">
                  V
                </text>
              </g>
            </g>
          </g>
          <g id="vi-word" clipPath="url(#vi-wordClip)">
            <text id="vi-wordText" fontFamily="Poppins, Segoe UI, sans-serif" fontSize="100" letterSpacing="-2">
              <tspan fontWeight="700" style={{ fill: 'var(--ink)' }}>
                VCFO
              </tspan>
              <tspan fontWeight="400" style={{ fill: 'var(--deep)' }}>
                {' Suite'}
              </tspan>
            </text>
          </g>
          <g id="vi-byline" opacity="0">
            <text id="vi-byText" fontFamily="Poppins, Segoe UI, sans-serif" fontSize="18" fontWeight="700" letterSpacing="3.5" style={{ fill: 'var(--ink)' }}>
              BY
            </text>
            <image id="vi-sbc" href="/sbc-logo-light.png" width="72" height="21.2" />
          </g>
        </svg>
        <button id="vi-skip" type="button" aria-label="Skip intro">
          Skip
        </button>
      </div>
    </div>
  );
}
