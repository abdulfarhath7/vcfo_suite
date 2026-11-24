'use client';

/** Field types that get their value at once (a chip pops) instead of being typed. */
const INSTANT_TYPES = new Set(['select', 'segmented', 'radio', 'checkbox', 'date', 'file', 'repeat']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** About 25 ms a character, but no field takes longer than ~1.2 s however long the value is. */
export const TYPE_DELAY_MS = 25;
const MAX_TICKS = 48;

export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return true;
  return (
    document.documentElement.getAttribute('data-reduce-motion') === 'true' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
export const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => resolve());
    else window.setTimeout(resolve, 16);
  });

/** True when this field should be set in one go (pickers, dates, files) rather than typed. */
export function isInstantField(shell: Element | null, value: string): boolean {
  const type = shell?.getAttribute('data-ask-field-type') ?? '';
  return INSTANT_TYPES.has(type) || ISO_DATE.test(value) || value.length <= 1;
}

/**
 * Types `value` through the form's own `setField` with a growing prefix, so the field shows the
 * characters arriving with its caret. Stops early when `cancelled()` turns true.
 */
export async function typeInto(
  setField: (value: string) => void,
  value: string,
  opts: { cancelled?: () => boolean; delayMs?: number } = {},
): Promise<void> {
  const { cancelled, delayMs = TYPE_DELAY_MS } = opts;
  const chunk = Math.max(1, Math.ceil(value.length / MAX_TICKS));
  for (let end = chunk; end < value.length + chunk; end += chunk) {
    if (cancelled?.()) return;
    setField(value.slice(0, Math.min(end, value.length)));
    if (end < value.length) await sleep(delayMs);
  }
}

/** The field's input, for the cursor to aim at; the shell itself when it has none. */
export function fieldTarget(shell: Element): Element {
  return shell.querySelector('input:not([type="file"]), textarea, [role="radiogroup"], button[role="combobox"], button') ?? shell;
}

/** Waits up to `timeoutMs` for the field to render (a new repeat entry, a tab that just opened). */
export async function waitForField(selector: string, timeoutMs = 1500): Promise<HTMLElement | null> {
  const started = Date.now();
  for (;;) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el || Date.now() - started >= timeoutMs) return el;
    await sleep(50);
  }
}
