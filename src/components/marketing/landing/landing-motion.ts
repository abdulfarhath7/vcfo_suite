"use client";
import * as React from "react";

export const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Inline style from a CSS string, so the markup stays the same as the old landing ("left:16.7%;--i:1"). */
export function st(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const part of css.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) continue;
    out[k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out as React.CSSProperties;
}

/**
 * Pinning and scroll-play run only on a wide, tall enough screen with motion allowed. The same query sits in
 * landing.css, which makes the pinned tracks tall and their stages sticky only under it (T5: phones stack).
 */
export const PIN_QUERY = "(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";

/** Pinned section #incorporate: light the 16 steps and their flow-chart groups up to `step` (1 to 16). */
function playStory(track: HTMLElement, step: number) {
  const ticks = Array.from(track.querySelectorAll<SVGElement>(".tk"));
  const groups = Array.from(track.querySelectorAll<SVGElement>(".sg"));
  const cur = ticks[step - 1]?.getAttribute("data-g");
  const lit = new Set(ticks.slice(0, step).map((t) => t.getAttribute("data-g")));
  ticks.forEach((t, i) => t.classList.toggle("on", i < step));
  groups.forEach((g) => {
    const k = g.getAttribute("data-g");
    g.classList.toggle("cur", k === cur);
    g.classList.toggle("done", k !== cur && lit.has(k));
  });
  // The stage rail beside the chart: stage 1 for steps 1 to 5, stage 2 for 6 to 15, the certificate at 16.
  const stage = step <= 5 ? "1" : step < 16 ? "2" : "coi";
  track.querySelectorAll(".rail .node").forEach((n) => n.classList.toggle("cur", n.getAttribute("data-stage") === stage));
  const label = track.querySelector(".tk-label");
  if (label) label.textContent = `Step ${step} of 16 · ${ticks[step - 1]?.querySelector("title")?.textContent?.replace(/^Step \d+: /, "") ?? ""}`;
}

/** Pinned section #comply: turn the ring to `turn` (0 to 1 of the year) and light the months up to it. */
function playRing(track: HTMLElement, turn: number) {
  const month = Math.min(11, Math.floor(turn * 12));
  (track as HTMLElement).style.setProperty("--hand", `${(turn * 360).toFixed(1)}deg`);
  if (track.getAttribute("data-month") === String(month)) return;
  track.setAttribute("data-month", String(month));
  track.querySelectorAll<SVGElement | HTMLElement>("[data-m]").forEach((d) => d.classList.toggle("off", Number(d.getAttribute("data-m")) > month));
}

/** Back to the resting state: every diagram complete. */
function rest(track: HTMLElement) {
  track.removeAttribute("data-playing");
  track.removeAttribute("data-month");
  track.style.removeProperty("--hand");
  track.querySelectorAll(".on, .cur, .done, .off").forEach((e) => e.classList.remove("on", "cur", "done", "off"));
  const label = track.querySelector(".tk-label");
  if (label) label.textContent = label.getAttribute("data-rest") ?? "";
}

/**
 * The landing's page script, scoped to the landing root (R-53):
 * - `.reveal` blocks are visible from the first paint. Only blocks below the fold at load are "armed" (`.rv`,
 *   a 22 px offset, never opacity), and they rise into place when they scroll in.
 * - `[data-play]` diagrams are complete at rest; `.in` plays their entrance (CSS keyframes) once when they come
 *   into view, again when the visitor scrolls back to them, and again on a click (see `replay`).
 * - `[data-count]` numbers are printed in full and count up once, in 0.8 s, when they are seen.
 * - `[data-pin]` tracks (#incorporate and #comply) pin their stage and play it with the scroll.
 * - The nav shadow sentinel.
 * Under reduced motion nothing is armed, nothing plays and nothing is pinned.
 */
export function useLandingMotion(root: React.RefObject<HTMLElement | null>, setScrolled: (v: boolean) => void) {
  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = reduceMotion();
    const hasIO = "IntersectionObserver" in window;
    const cleanups: (() => void)[] = [];

    const countUp = (n: HTMLElement) => {
      if (n.dataset.counted) return;
      n.dataset.counted = "1";
      const target = parseInt(n.getAttribute("data-count") || "0", 10);
      n.textContent = String(target);
      if (reduce || !target) return;
      let start = 0;
      const tick = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / 800);
        n.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const blocks = Array.from(el.querySelectorAll<HTMLElement>(".reveal, [data-play]"));
    if (!reduce && hasIO) {
      const fold = window.innerHeight;
      blocks.forEach((b) => {
        if (b.classList.contains("reveal") && b.getBoundingClientRect().top > fold) b.classList.add("rv");
      });
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            const t = e.target as HTMLElement;
            if (e.isIntersecting && e.intersectionRatio >= 0.15) {
              t.classList.remove("rv");
              t.classList.add("in");
              t.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
              if (!t.hasAttribute("data-play")) io.unobserve(t);
            } else if (!e.isIntersecting && t.hasAttribute("data-play")) {
              t.classList.remove("in");
            }
          }),
        { threshold: [0, 0.15] },
      );
      blocks.forEach((b) => io.observe(b));
      cleanups.push(() => io.disconnect());
    }

    const tracks = Array.from(el.querySelectorAll<HTMLElement>("[data-pin]"));
    if (tracks.length) {
      const mq = window.matchMedia(PIN_QUERY);
      let raf = 0;
      const update = () => {
        raf = 0;
        const nav = 68;
        tracks.forEach((track) => {
          const r = track.getBoundingClientRect();
          // It plays only once its top is in the upper half of the screen, so it never plays on the first
          // screen at load (R5: the page opens with every diagram complete) and rests again once it has left.
          const active = r.top < window.innerHeight * 0.5 && r.bottom > 0;
          if (!mq.matches || !active) {
            if (track.hasAttribute("data-playing")) rest(track);
            return;
          }
          const span = Math.max(1, r.height - (window.innerHeight - nav));
          // The play ends at 90 % of the pinned scroll, so the finished diagram holds for a moment before it leaves.
          const p = Math.min(1, Math.max(0, (nav - r.top) / span) / 0.9);
          track.setAttribute("data-playing", "");
          if (track.getAttribute("data-pin") === "story") playStory(track, Math.max(1, Math.ceil(p * 16)));
          else playRing(track, p);
        });
      };
      const onScroll = () => {
        if (!raf) raf = requestAnimationFrame(update);
      };
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll);
      mq.addEventListener?.("change", onScroll);
      update();
      cleanups.push(() => {
        removeEventListener("scroll", onScroll);
        removeEventListener("resize", onScroll);
        mq.removeEventListener?.("change", onScroll);
        if (raf) cancelAnimationFrame(raf);
        tracks.forEach(rest);
      });
    }

    const sentinel = el.querySelector(".nav-sentinel");
    if (hasIO && sentinel) {
      const nio = new IntersectionObserver((entries) => setScrolled(!entries[0].isIntersecting));
      nio.observe(sentinel);
      cleanups.push(() => nio.disconnect());
    }
    return () => cleanups.forEach((c) => c());
  }, [root, setScrolled]);
}

/** R6: a click on a played diagram (not on one of its click-through items) plays it again. */
export function replay(target: Element | null) {
  const d = target?.closest?.<HTMLElement>("[data-play]");
  if (!d || reduceMotion()) return;
  d.classList.remove("in");
  void d.offsetWidth;
  d.classList.add("in");
}
