'use client';

/**
 * Live (Tailwind / Radix) components portal their dialogs, menus and toasts into
 * <body>, outside the portal / console root that carries `data-theme`, so they
 * took the app's light tokens inside a dark portal. app/globals.css defines the
 * app's dark tokens for `.dark, [data-theme="dark"]`: while a root is mounted,
 * <body> carries the same theme (and colour scheme), so those pop-ups match it.
 * The person's saved app theme (next-themes, on <html>) is left alone.
 */
import { useEffect, useState } from 'react';

export function useBodyTheme(theme: 'light' | 'dark' | 'system') {
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const b = document.body;
    const prev = b.getAttribute('data-theme');
    const prevScheme = b.style.colorScheme;
    b.setAttribute('data-theme', resolved);
    b.style.colorScheme = resolved;
    return () => {
      if (prev === null) b.removeAttribute('data-theme');
      else b.setAttribute('data-theme', prev);
      b.style.colorScheme = prevScheme;
    };
  }, [resolved]);
}
