/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import toast, { useToaster } from 'react-hot-toast';
import { afterEach, describe, expect, it } from 'vitest';
import { TOAST_ERROR_MS, TOAST_LIMIT, TOAST_MS, TOAST_NEWEST_ON_TOP, toastsOverLimit } from './hot-toast';
import { toastUndo } from './undo-toast';
import { toastSaved } from './toast-saved';

/** GL-02: a short life and a limit of three. */
describe('toast stack', () => {
  const t = (id: string, visible = true) => ({ id, visible });

  afterEach(() => {
    act(() => toast.remove());
  });

  it('lasts 3 seconds, or 6 for an error', () => {
    expect(TOAST_MS).toBe(3000);
    expect(TOAST_ERROR_MS).toBe(6000);
    expect(TOAST_LIMIT).toBe(3);
  });

  it('closes the oldest when five actions run quickly', () => {
    // The store lists the newest first.
    expect(toastsOverLimit([t('e'), t('d'), t('c'), t('b'), t('a')])).toEqual(['b', 'a']);
  });

  it('leaves three or fewer alone and ignores toasts already closing', () => {
    expect(toastsOverLimit([t('c'), t('b'), t('a')])).toEqual([]);
    expect(toastsOverLimit([t('d'), t('c', false), t('b'), t('a')])).toEqual([]);
  });

  it('puts the newest toast on top of the bottom-corner stack', () => {
    // The offset is the distance from the bottom edge, so the newest must be the farthest up.
    const { result } = renderHook(() => useToaster());
    let older = '';
    let newer = '';
    act(() => {
      older = toast('First');
      newer = toast('Second');
    });
    act(() => {
      result.current.handlers.updateHeight(older, 40);
      result.current.handlers.updateHeight(newer, 40);
    });
    const byId = (id: string) => result.current.toasts.find((x) => x.id === id)!;
    const offset = (id: string) =>
      result.current.handlers.calculateOffset(byId(id), { reverseOrder: TOAST_NEWEST_ON_TOP, gutter: 10, defaultPosition: 'bottom-left' });
    expect(offset(older)).toBe(0);
    expect(offset(newer)).toBeGreaterThan(offset(older));
  });

  it('gives the shared custom toasts 3 seconds, or 6 with an Undo or an action', () => {
    const { result } = renderHook(() => useToaster());
    const dur = (id: string) => result.current.toasts.find((x) => x.id === id)?.duration;
    let plain = '';
    let withUndo = '';
    act(() => {
      plain = toastSaved('Saved', { id: 'a' });
      withUndo = toastSaved('Saved', { id: 'b', onUndo: () => {} });
    });
    expect(dur(plain)).toBe(TOAST_MS);
    expect(dur(withUndo)).toBe(TOAST_ERROR_MS);
    let line = '';
    act(() => {
      line = toastUndo('Link copied');
    });
    expect(dur(line)).toBe(TOAST_MS);
    act(() => {
      line = toastUndo('Marked done', () => {});
    });
    expect(dur(line)).toBe(TOAST_ERROR_MS);
  });
});
