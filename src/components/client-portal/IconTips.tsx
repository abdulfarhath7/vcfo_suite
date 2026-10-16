'use client';

/**
 * Rule 17 — every icon-only control explains itself on hover (prototype proto.js
 * "icon-only controls explain themselves"): a navy tooltip after 120 ms with the
 * control's aria-label. Skipped where the meaning is obvious (OBVIOUS list, as
 * in the prototype), where the control has text, a data-tip, or data-notip.
 */
import { useEffect } from 'react';
import { usePortal } from './PortalProvider';

const OBVIOUS =
  /^(WhatsApp|Call|Email|Teams|Phone|Message)\b|^About\b|^More actions\b|^Notifications(,|$)|^(More information|Close|Ask VCFO|Open Ask VCFO|SBC home|Search( \(⌘K\))?|Details|Open|Open menu|Announcements|Photo placeholder|PDF file|Word document|Excel (sheet|file)|PowerPoint( deck| file)?|Text file|CSV file|Image \([A-Z]+\))$/i;

export function IconTips() {
  const { tipAt } = usePortal();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: Element | null = null;
    const hide = () => {
      if (timer) clearTimeout(timer);
      current = null;
      tipAt(0, 0, null);
    };
    const over = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const el = t?.closest?.('a,button,[role="button"]');
      if (!el || !el.closest('.cp') || el.closest('.vps,[data-notip]')) return hide();
      if (el === current) return;
      const label = el.getAttribute('aria-label');
      const txt = (el.textContent ?? '').trim();
      if (!label || txt.length > 2 || el.hasAttribute('data-tip') || el.querySelector('.tt') || OBVIOUS.test(label)) return hide();
      current = el;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        tipAt(r.left + r.width / 2, r.top + 8, label);
      }, 120);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('scroll', hide, true);
      if (timer) clearTimeout(timer);
    };
  }, [tipAt]);
  return null;
}
