/**
 * The script the live browser injects into every portal page. It is the VCFO Assist extension's
 * own content-script code (`PortalAgent`, the guards, the scanner, the filler and the overlay),
 * bundled by `build.mjs` into one IIFE, so the live browser fills with exactly the code the
 * extension uses. It adds one thing the extension does not need: `typeInto`, which writes a text
 * value one character at a time so the person watching can follow it. `typeInto` runs the guards
 * on the control first, writes only partial values without firing events, and is always followed
 * by the agent's real, guarded fill, which sets the full value and fires the form's events.
 */
import { PortalAgent, type PortalRequest } from '../../../../extensions/vcfo-assist/src/portal/agent';
import { bridgeSetValue, readBridgeModel } from '../../../../extensions/vcfo-assist/src/portal/bridge';
import { locate } from '../../../../extensions/vcfo-assist/src/portal/scanner';
import { guardFill } from '../../../../extensions/vcfo-assist/src/guards/dom';
import { SECRET_FIELD_PATTERN } from '../../../../extensions/vcfo-assist/src/guards';
import type { FieldTarget } from '../../../../extensions/vcfo-assist/src/shared/types';

interface LiveApi {
  handle(req: PortalRequest): Promise<unknown>;
  readBridge(): ReturnType<typeof readBridgeModel>;
  bridgeSet(som: string, value: string): ReturnType<typeof bridgeSetValue>;
  typeInto(target: FieldTarget, value: string, msPerChar: number, maxMs: number): Promise<{ ok: boolean; reason?: string }>;
  pageChanged(): number;
}

const w = window as unknown as { __vcfoLive?: LiveApi };

if (!w.__vcfoLive) {
  const agent = new PortalAgent(document);
  let changes = 0;
  const watch = () => {
    if (!document.body) return;
    new MutationObserver(() => {
      changes += 1;
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  };
  if (document.body) watch();
  else document.addEventListener('DOMContentLoaded', watch, { once: true });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  w.__vcfoLive = {
    handle: (req) => agent.handle(req),
    readBridge: () => readBridgeModel(),
    bridgeSet: (som, value) => bridgeSetValue(som, value, SECRET_FIELD_PATTERN.source),
    async typeInto(target, value, msPerChar, maxMs) {
      const el = locate(document, target);
      if (!el) return { ok: false, reason: 'control not found' };
      // The same guard as every write: a login, captcha, OTP or password control is never touched.
      const refused = guardFill(el);
      if (refused) return { ok: false, reason: refused.reason };
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      const isText = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['radio', 'checkbox', 'file', 'hidden', 'submit', 'button'].includes(el.type));
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      if (!isText || input.disabled || input.readOnly) {
        await sleep(Math.min(450, maxMs));
        return { ok: true };
      }
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as object, 'value')?.set;
      const step = value.length ? Math.max(1, Math.ceil((value.length * msPerChar) / Math.max(maxMs, 1))) : 1;
      const delay = Math.max(8, Math.min(msPerChar, Math.floor(maxMs / Math.max(1, value.length))));
      for (let i = step; i < value.length + step; i += step) {
        const part = value.slice(0, Math.min(i, value.length));
        if (setter) setter.call(input, part);
        else input.value = part;
        await sleep(delay);
      }
      return { ok: true };
    },
    pageChanged: () => changes,
  };
}
