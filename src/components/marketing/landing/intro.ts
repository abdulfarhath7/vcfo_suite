/**
 * The landing's logo reveal, ported from the prototype (design/spectrum, src/screens/public/LandingParts.tsx).
 * It builds one fixed SVG overlay from static markup (no script tags) and removes it when it ends.
 */

/**
 * The opening beat of the old landing: the three stage cards stack into the VCFO mark,
 * the word mark is drawn, then the lockup glides into the nav logo. About 3.5 s; any input skips it.
 * Returns a cleanup that stops it at once.
 */
export function playIntro(opts: { root: HTMLElement; hero: HTMLElement; navImg: HTMLElement; release: () => void; finish: () => void }) {
  const { root, hero, navImg, release, finish } = opts;
  const NS = "http://www.w3.org/2000/svg";
  const wrap = document.createElement("div");
  wrap.id = "reveal";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML =
    '<svg id="rv-svg" viewBox="72 50 1000 400" xmlns="' + NS + '">' +
    '<defs><clipPath id="rv-wordClip"><rect id="rv-wordClipRect" x="0" y="0" width="0" height="1000"/></clipPath>' +
    '<clipPath id="rv-vClip"><rect id="rv-vClipRect" x="0" y="0" width="0" height="0"/></clipPath></defs>' +
    '<g id="rv-lockup"><g id="rv-stack">' +
    '<g id="rv-card0" opacity="0"><polygon class="shape c0"/><text class="cname n0" text-anchor="middle" font-weight="700">Incorporation</text></g>' +
    '<g id="rv-card1" opacity="0"><polygon class="shape c1"/><text class="cname n1" text-anchor="middle" font-weight="700">Registrations</text></g>' +
    '<g id="rv-card2" opacity="0"><polygon class="shape c2"/><text class="cname n2" text-anchor="middle" font-weight="700">Compliances</text>' +
    '<g clip-path="url(#rv-vClip)"><text id="rv-vee" class="vee" text-anchor="middle" font-weight="700">V</text></g></g>' +
    '</g><g id="rv-word" clip-path="url(#rv-wordClip)"><text id="rv-wordText" font-size="100" letter-spacing="-2">' +
    '<tspan class="w1" font-weight="700">VCFO</tspan><tspan class="w2" font-weight="400"> Suite</tspan></text></g>' +
    '<g id="rv-byline" opacity="0"><text id="rv-byText" class="by" font-size="18" font-weight="700" letter-spacing="3.5">BY</text>' +
    '<image id="rv-sbc" href="/landing/sbc-mark.webp" width="72" height="21.3"/></g></g></svg>';
  root.appendChild(wrap);
  // The intro is placed in the landing root's coordinates (it is absolute, not fixed), so it sits
  // over the hero only and never shows further down the page, for example in a full-page capture.
  const place = () => {
    const r = hero.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    const top = Math.max(0, r.top);
    const h = Math.min(r.bottom, innerHeight) - top;
    wrap.style.left = r.left - base.left + "px";
    wrap.style.top = top - base.top + "px";
    wrap.style.width = r.width + "px";
    wrap.style.height = Math.max(240, h) + "px";
  };
  place();
  const $ = (id: string) => wrap.querySelector("#rv-" + id) as SVGElement;
  const svg = $("svg") as SVGSVGElement;
  const stack = $("stack");
  const lockup = $("lockup");
  const cards = [0, 1, 2].map((i) => $("card" + i));
  const names = Array.from(wrap.querySelectorAll<SVGTextElement>(".cname"));
  const vClipRect = $("vClipRect");
  const wordClipRect = $("wordClipRect");
  const wordText = $("wordText");
  const byline = $("byline");
  const byText = $("byText");
  const sbc = $("sbc");
  const vee = $("vee");
  const W = 215, DX = 37, DH = 62, LH = 75, RISE = 135, FULL = LH + RISE + 2 * DH;
  const MARK_H = 220, K = MARK_H / FULL, MARK_W = (W + 2 * DX) * K, NAME_FS = 15;
  const GEO = [0, 1, 2].map((i) => {
    const n = 2 - i;
    const x0 = DX * n * K, lh = (LH + DH * n) * K, rh = (LH + RISE + DH * n) * K, w = W * K;
    return { x0, w, lh, rh, cx: x0 + w / 2 };
  });
  GEO.forEach((g, i) => {
    cards[i].querySelector(".shape")!.setAttribute("points", `${g.x0},0 ${g.x0},${-g.lh} ${g.x0 + g.w},${-g.rh} ${g.x0 + g.w},0`);
    const t = names[i];
    t.setAttribute("x", String(g.cx));
    t.setAttribute("y", (-Math.min(g.lh, 60) * 0.55).toFixed(1));
    t.setAttribute("font-size", String(NAME_FS));
  });
  const F = GEO[2], vx = F.x0 + F.w * 0.52, vbase = -22 * K, vsize = 115 * K;
  vee.setAttribute("x", String(vx));
  vee.setAttribute("y", String(vbase));
  vee.setAttribute("font-size", String(vsize));
  vClipRect.setAttribute("x", String(vx - vsize));
  vClipRect.setAttribute("width", String(vsize * 2));
  type Layout = { vb: number[]; cx: number; cy: number; fs: number; fo: number[]; wx: number; wy: number; by: number; anchor: string; s1: number };
  const LAYOUTS: Record<"wide" | "square", Layout> = {
    wide: { vb: [72, 50, 1000, 400], cx: 600, cy: 250, fs: 0.72, fo: [220, 340], wx: 371, wy: 287, by: 327, anchor: "start", s1: 1.55 },
    square: { vb: [40, 160, 720, 540], cx: 400, cy: 400, fs: 0.9, fo: [400 - MARK_W * 0.45, 440], wx: 400, wy: 570, by: 616, anchor: "middle", s1: 1.8 },
  };
  let L = LAYOUTS.wide;
  let s0 = 1;
  let cur = 0;
  const DUR = 7.0, SPEED = 1.6;
  const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
  const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeBack = (x: number) => {
    const c1 = 1.4, c3 = c1 + 1;
    return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
  const renderAt = (t: number) => {
    cur = t;
    const gx = L.cx - (MARK_W * s0) / 2, gy = L.cy + (MARK_H * s0) / 2;
    const mv = easeInOut(seg(t, 3.7, 4.5)), sc = lerp(s0, L.fs, mv);
    const ox = lerp(gx, L.fo[0], mv), oy = lerp(gy, L.fo[1], mv);
    const pulse = 1 + Math.sin(Math.PI * seg(t, 3.15, 3.6)) * 0.04;
    stack.setAttribute("transform", `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${(sc * pulse).toFixed(4)})`);
    const arr: number[] = [];
    for (let i = 0; i < 3; i++) {
      const a = 0.35 + i * 0.7, p = seg(t, a, a + 0.75);
      cards[i].setAttribute("transform", `scale(1 ${Math.max(0.001, easeBack(p)).toFixed(4)})`);
      cards[i].setAttribute("opacity", clamp(p * 8).toFixed(3));
      arr.push(easeOut(p));
    }
    const nameFade = 1 - seg(t, 2.85, 3.1);
    for (let j = 0; j < 3; j++) {
      const shown = clamp(seg(t, 0.35 + j * 0.5, 0.75 + j * 0.5) * 3), covered = j < 2 ? arr[j + 1] : 0;
      names[j].setAttribute("opacity", (nameFade * (1 - covered) * Math.min(1, shown)).toFixed(3));
    }
    const vp = easeOut(seg(t, 3.05, 3.5));
    vClipRect.setAttribute("y", (vbase - vsize).toFixed(2));
    vClipRect.setAttribute("height", (vsize * 1.1 * vp).toFixed(2));
    const wp = easeInOut(seg(t, 4.1, 5.0)), ww = 640 * wp;
    wordClipRect.setAttribute("x", L.anchor === "middle" ? (L.wx - ww / 2).toFixed(2) : String(L.wx - 10));
    wordClipRect.setAttribute("width", (wp > 0 ? ww + 20 : 0).toFixed(2));
    const bp = easeOut(seg(t, 4.8, 5.4));
    byline.setAttribute("opacity", bp.toFixed(3));
    byline.setAttribute("transform", `translate(0 ${((1 - bp) * 8).toFixed(2)})`);
  };
  const setLayout = () => {
    L = LAYOUTS[wrap.clientWidth / Math.max(1, wrap.clientHeight) < 1.05 ? "square" : "wide"];
    svg.setAttribute("viewBox", L.vb.join(" "));
    wordText.setAttribute("x", String(L.wx));
    wordText.setAttribute("y", String(L.wy));
    wordText.setAttribute("text-anchor", L.anchor);
    const bx = L.anchor === "middle" ? L.wx - 57 : L.wx + 6;
    byText.setAttribute("x", String(bx));
    byText.setAttribute("y", String(L.by));
    sbc.setAttribute("x", String(bx + 36));
    sbc.setAttribute("y", (L.by - 0.707 * 21.3).toFixed(2));
    const r = svg.getBoundingClientRect();
    const ppu = Math.min(r.width / L.vb[2], r.height / L.vb[3]) || 1;
    s0 = Math.max(1, Math.min(L.s1, 11.5 / (NAME_FS * ppu)));
    renderAt(cur);
  };
  setLayout();
  let raf = 0;
  let last = -1;
  let t = 0;
  let done = false;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (f: () => void, ms: number) => timers.push(setTimeout(f, ms));
  const EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  const skip = () => glide(true);
  const onResize = () => {
    place();
    setLayout();
  };
  const unlisten = () => {
    EVENTS.forEach((ev) => removeEventListener(ev, skip, true));
    removeEventListener("resize", onResize);
  };
  function glide(fast: boolean) {
    if (done) return;
    done = true;
    if (raf) cancelAnimationFrame(raf);
    renderAt(DUR);
    unlisten();
    const o = svg.getBoundingClientRect(), r = lockup.getBoundingClientRect(), n = navImg.getBoundingClientRect();
    const k = n.height / Math.max(1, r.height);
    const tx = n.left - o.left - k * (r.left - o.left), ty = n.top - o.top - k * (r.top - o.top);
    later(release, fast ? 60 : 260);
    wrap.classList.add("glide");
    if (fast) wrap.classList.add("fast");
    requestAnimationFrame(() => {
      svg.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${k.toFixed(4)})`;
    });
    later(
      () => {
        finish();
        wrap.classList.add("gone");
        later(() => wrap.remove(), 220);
        if ("scrollRestoration" in history) history.scrollRestoration = "auto";
      },
      fast ? 340 : 740,
    );
  }
  const tick = (now: number) => {
    if (cancelled) return;
    if (last >= 0) t += (Math.min(50, Math.max(0, now - last)) / 1000) * SPEED;
    last = now;
    if (t >= 5.6) {
      renderAt(DUR);
      later(() => glide(false), 280);
      return;
    }
    renderAt(t);
    raf = requestAnimationFrame(tick);
  };
  EVENTS.forEach((ev) => addEventListener(ev, skip, { capture: true, passive: true }));
  addEventListener("resize", onResize);
  const go = () => {
    if (cancelled) return;
    renderAt(0);
    raf = requestAnimationFrame(tick);
  };
  const family = getComputedStyle(root).getPropertyValue("--lp-poppins").trim() || "Poppins";
  Promise.race([Promise.all([document.fonts.load(`700 20px ${family}`), document.fonts.load(`400 20px ${family}`)]), new Promise((r) => setTimeout(r, 400))])
    .catch(() => undefined)
    .then(go);
  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    unlisten();
    wrap.remove();
  };
}
