import { describe, expect, it } from 'vitest';
import { TOAST_ERROR_MS, TOAST_LIMIT, TOAST_MS, toastsOverLimit } from './hot-toast';

/** GL-02: a short life and a limit of three. */
describe('toast stack', () => {
  const t = (id: string, visible = true) => ({ id, visible });

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
});
