'use client';

/**
 * The Ask VCFO mascot (prototype a6_rest.js MASCOTS / setMascot): a per-browser
 * choice in localStorage 'vcfo-mascot', shown on the floating button, the chat
 * header and Settings. Same-tab changes travel through a window event so the
 * button updates the moment Settings picks another one.
 */
import { useEffect, useState } from 'react';

export const MASCOTS: Array<[key: string, name: string]> = [
  ['robot', 'Vee · robot'],
  ['orb', 'Nova · orbit'],
  ['owl', 'Ollie · owl'],
  ['fox', 'Finn · fox'],
  ['panda', 'Bao · panda'],
  ['astro', 'Astro'],
  ['coin', 'Rupi · coin'],
];
const KEY = 'vcfo-mascot';
const EVENT = 'vcfo-mascot';

export function readMascot(): string {
  try {
    const m = localStorage.getItem(KEY);
    if (m && MASCOTS.some((x) => x[0] === m)) return m;
  } catch {
    /* storage unavailable */
  }
  return 'robot';
}

export function writeMascot(k: string) {
  try {
    localStorage.setItem(KEY, k);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: k }));
}

export function mascotName(k: string): string {
  return MASCOTS.find((m) => m[0] === k)?.[1] ?? MASCOTS[0]![1];
}

/** The current mascot key; re-renders when Settings changes it (or another tab does). */
export function useMascot(): string {
  const [m, setM] = useState('robot');
  useEffect(() => {
    setM(readMascot());
    const on = () => setM(readMascot());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return m;
}
