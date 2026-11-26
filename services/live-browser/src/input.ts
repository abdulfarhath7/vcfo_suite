/**
 * Viewer messages. `parseClientMessage` accepts only the shapes in the contract, with numbers
 * clamped and strings bounded; anything else is dropped. `isInput` tells input (act only) from
 * control (pause, resume, confirm). Input is forwarded to the remote browser with CDP and is never
 * logged, counted by content or stored: a password or OTP typed by the person passes through here.
 */
import type { StreamClientMessage } from '../../../src/lib/live-browser/contract';

const MOUSE_TYPES = new Set(['mousePressed', 'mouseReleased', 'mouseMoved']);
const BUTTONS = new Set(['left', 'middle', 'right', 'none']);
const KEY_TYPES = new Set(['keyDown', 'keyUp', 'rawKeyDown', 'char']);
const EVENTS = new Set(['CONFIRM_FILL', 'RETRY', 'REFILL', 'SKIP_TEACH']);

const num = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.length <= max ? v : undefined);

export function parseClientMessage(raw: string, viewport: { w: number; h: number }): StreamClientMessage | null {
  if (raw.length > 4096) return null;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  switch (m.t) {
    case 'mouse': {
      const x = num(m.x, 0, viewport.w);
      const y = num(m.y, 0, viewport.h);
      if (x === null || y === null || !MOUSE_TYPES.has(String(m.type))) return null;
      const button = BUTTONS.has(String(m.button)) ? (m.button as 'left') : 'none';
      return { t: 'mouse', type: m.type as 'mouseMoved', x, y, button, clickCount: num(m.clickCount, 0, 3) ?? 0, modifiers: num(m.modifiers, 0, 15) ?? 0 };
    }
    case 'wheel': {
      const x = num(m.x, 0, viewport.w);
      const y = num(m.y, 0, viewport.h);
      const dx = num(m.dx, -5000, 5000);
      const dy = num(m.dy, -5000, 5000);
      if (x === null || y === null || dx === null || dy === null) return null;
      return { t: 'wheel', x, y, dx, dy };
    }
    case 'key': {
      const key = str(m.key, 40);
      if (!key || !KEY_TYPES.has(String(m.type))) return null;
      return {
        t: 'key',
        type: m.type as 'keyDown',
        key,
        code: str(m.code, 40),
        text: str(m.text, 4),
        keyCode: num(m.keyCode, 0, 255) ?? undefined,
        modifiers: num(m.modifiers, 0, 15) ?? 0,
      };
    }
    case 'text': {
      const text = str(m.text, 1000);
      return text ? { t: 'text', text } : null;
    }
    case 'pause':
    case 'resume':
      return { t: m.t };
    case 'event':
      return EVENTS.has(String(m.event)) ? { t: 'event', event: m.event as 'RETRY' } : null;
    default:
      return null;
  }
}

export function isInput(m: StreamClientMessage): boolean {
  return m.t === 'mouse' || m.t === 'wheel' || m.t === 'key' || m.t === 'text';
}

/** The CDP command for one input message. */
export function cdpCommandFor(m: StreamClientMessage): { method: string; params: Record<string, unknown> } | null {
  switch (m.t) {
    case 'mouse':
      return {
        method: 'Input.dispatchMouseEvent',
        params: {
          type: m.type,
          x: m.x,
          y: m.y,
          button: m.button ?? 'none',
          buttons: m.type === 'mousePressed' && m.button === 'left' ? 1 : 0,
          clickCount: m.clickCount ?? 0,
          modifiers: m.modifiers ?? 0,
        },
      };
    case 'wheel':
      return { method: 'Input.dispatchMouseEvent', params: { type: 'mouseWheel', x: m.x, y: m.y, deltaX: m.dx, deltaY: m.dy } };
    case 'key': {
      // A printable key carries its text on keyDown, so the page gets keydown, keypress and input.
      const printable = m.type === 'keyDown' && m.text && m.text.length === 1 && !(m.modifiers && m.modifiers & 2);
      return {
        method: 'Input.dispatchKeyEvent',
        params: {
          type: m.type === 'keyDown' && !printable ? 'rawKeyDown' : m.type,
          key: m.key,
          code: m.code,
          ...(printable ? { text: m.text, unmodifiedText: m.text } : {}),
          windowsVirtualKeyCode: m.keyCode,
          nativeVirtualKeyCode: m.keyCode,
          modifiers: m.modifiers ?? 0,
        },
      };
    }
    case 'text':
      return { method: 'Input.insertText', params: { text: m.text } };
    default:
      return null;
  }
}
