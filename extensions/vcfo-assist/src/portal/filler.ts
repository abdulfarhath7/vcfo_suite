/**
 * DOM FILLER (content script) — the fallback when guideBridge is absent or did not take, and the
 * path the real MCA forms use (the old MCA filler's tuning, ported).
 *
 * It writes through the prototype's native value setter and then fires input, keyup, change and
 * blur, in that order, which React, Angular and AEM's jQuery handlers all listen to (MCA's PIN code
 * lookups and totals run on keyup and change). Selects are matched by option value, then text, then
 * a prefix, then a unique "contains"; a dependent dropdown is polled until its option appears
 * (`fillWhenReady`). Radio groups are matched by label or value, with Yes/No aliases (true, y). Every
 * write calls the guards first (`guardFill`), and a refused control is never touched.
 */
import { guardFill } from '../guards/dom';
import { clean, labelFor } from './label';
import type { GuardRefusal } from '../shared/types';

/** Plain optional fields (not a union), so it narrows the same under strict and non-strict tsc. */
export interface FillResult {
  ok: boolean;
  via?: 'dom' | 'guideBridge';
  refused?: GuardRefusal;
  reason?: string;
}

const norm = (s: string): string => clean(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** The option whose text best matches `value`: exact, then a "62 - …" style code prefix, then contains. */
export function pickOption(options: string[], value: string): number {
  const v = norm(value);
  if (!v) return -1;
  let i = options.findIndex((o) => norm(o) === v);
  if (i >= 0) return i;
  i = options.findIndex((o) => new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(norm(o)));
  if (i >= 0) return i;
  const containing = options.map((o, idx) => ({ o: norm(o), idx })).filter((x) => x.o.includes(v) || (x.o.length > 2 && v.includes(x.o)));
  return containing.length === 1 ? containing[0]!.idx : -1;
}

function setNative(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function fire(el: Element, types: string[]): void {
  const view = el.ownerDocument.defaultView ?? window;
  for (const type of types) {
    const ev =
      type === 'blur' || type === 'focus'
        ? new view.FocusEvent(type)
        : type === 'keyup' || type === 'keydown'
          ? new view.KeyboardEvent(type, { bubbles: true, key: 'Unidentified' })
          : new view.Event(type, { bubbles: true });
    el.dispatchEvent(ev);
  }
}

/** The option index for `value` in a select: normalised value, then text, prefix and unique contains. */
export function selectIndex(select: HTMLSelectElement, value: string): number {
  const opts = Array.from(select.options);
  const v = norm(value);
  const byValue = opts.findIndex((o) => o.value !== '' && (o.value === value || norm(o.value) === v));
  if (byValue >= 0) return byValue;
  return pickOption(opts.map((o) => o.text), value);
}

const YES_NO: Record<string, string> = { true: 'yes', y: 'yes', yes: 'yes', false: 'no', n: 'no', no: 'no' };

/** True when the control already shows `value` (so the guideBridge write took). */
export function showsValue(el: Element, value: string): boolean {
  if (el instanceof el.ownerDocument.defaultView!.HTMLSelectElement) {
    const opt = el.options[el.selectedIndex];
    return Boolean(opt) && (norm(opt!.text) === norm(value) || pickOption([opt!.text], value) === 0 || opt!.value === value);
  }
  if ((el as HTMLInputElement).type === 'radio') {
    const doc = el.ownerDocument;
    const checked = doc.querySelector<HTMLInputElement>(`input[type="radio"][name="${(el as HTMLInputElement).name}"]:checked`);
    return Boolean(checked) && (norm(labelFor(checked!)) === norm(value) || checked!.value.toLowerCase() === value.toLowerCase());
  }
  return (el as HTMLInputElement).value === value;
}

export function fillElement(el: Element, value: string): FillResult {
  const refused = guardFill(el);
  if (refused) return { ok: false, refused, reason: `${refused.code}: ${refused.reason}` };
  const view = el.ownerDocument.defaultView!;

  if (el instanceof view.HTMLSelectElement) {
    const pick = selectIndex(el, value);
    if (pick < 0) return { ok: false, reason: 'no matching option' };
    fire(el, ['focus']);
    setNative(el, el.options[pick]!.value);
    fire(el, ['input', 'change', 'blur']);
    return { ok: true, via: 'dom' };
  }

  if (el instanceof view.HTMLInputElement && el.type === 'radio') {
    const group = Array.from(el.ownerDocument.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${el.name}"]`));
    const labels = group.map((r) => labelFor(r) || r.value);
    const want = YES_NO[value.trim().toLowerCase()] ?? value;
    let idx = pickOption(labels, want);
    if (idx < 0) idx = group.findIndex((r) => r.value.toLowerCase() === want.toLowerCase() || YES_NO[r.value.toLowerCase()] === want);
    if (idx < 0) return { ok: false, reason: 'no matching option' };
    const radio = group[idx]!;
    const refusedRadio = guardFill(radio);
    if (refusedRadio) return { ok: false, refused: refusedRadio, reason: refusedRadio.reason };
    if (!radio.checked) radio.click();
    fire(radio, ['input', 'change', 'blur']);
    return { ok: true, via: 'dom' };
  }

  if (el instanceof view.HTMLInputElement || el instanceof view.HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return { ok: false, reason: 'control is read-only' };
    fire(el, ['focus']);
    setNative(el, value);
    fire(el, ['input', 'keyup', 'change', 'blur']);
    return { ok: true, via: 'dom' };
  }
  return { ok: false, reason: 'not a form control' };
}

/** How often a dependent dropdown is checked for its option. */
export const OPTION_POLL_MS = 300;

/**
 * Like `fillElement`, but a select whose wanted option is not there yet (it loads after an earlier
 * choice, for example MCA's class after type of company) is polled up to `optionsMs` (8 s on MCA).
 */
export async function fillWhenReady(el: Element, value: string, optionsMs = 0): Promise<FillResult> {
  const view = el.ownerDocument.defaultView!;
  if (el instanceof view.HTMLSelectElement && optionsMs > 0) {
    const deadline = Date.now() + optionsMs;
    while (selectIndex(el, value) < 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, OPTION_POLL_MS));
    }
  }
  return fillElement(el, value);
}
