'use client';

import { useEffect } from 'react';

/**
 * "Your turn" signals (CARD-AGENTS.md, owner change "watch in the app, act in the portal tab").
 * Browsers do not let a page switch tabs by itself, so the app plays a short sound and shows a
 * desktop notification (only when the person allowed them), and the portal tab flashes its title
 * and icon until the person looks at it.
 */

/** The named window the portal tab opens in, so "Go to portal tab" focuses the same tab again. */
export const portalWindowName = (sessionId: string) => `vcfo-live-${sessionId}`;

/** Opens the portal tab, or brings the open one back to the front. */
export function openPortalTab(href: string, sessionId: string): void {
  const w = window.open(href, portalWindowName(sessionId));
  w?.focus();
}

/** Asked on the person's own click ("Fill now"), never on page load. */
export function askNotifyPermission(): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  void Notification.requestPermission().catch(() => undefined);
}

export function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'vcfo-live-your-turn' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some browsers allow notifications only from a service worker; the sound and the banner remain.
  }
}

/** A short two-note chime (Web Audio), quiet and under half a second. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    for (const [i, f] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.16);
    }
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // No sound: the banner and the title flash still show.
  }
}

const DOT_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23d9480f'/%3E%3Ctext x='16' y='22' font-size='18' text-anchor='middle' fill='white' font-family='sans-serif'%3E!%3C/text%3E%3C/svg%3E";

/** Flashes the tab's title and icon while `active`. Restores both when it stops. */
export function useTitleFlash(active: boolean, text = 'Your turn'): void {
  useEffect(() => {
    if (!active) return;
    const title = document.title;
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const icon = link?.href ?? null;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      document.title = on ? `● ${text}` : title;
      if (link) link.href = on ? DOT_ICON : (icon ?? link.href);
    }, 900);
    return () => {
      clearInterval(id);
      document.title = title;
      if (link && icon) link.href = icon;
    };
  }, [active, text]);
}
