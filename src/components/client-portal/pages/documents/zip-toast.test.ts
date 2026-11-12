import { describe, expect, it } from 'vitest';
import { zipToastDuration } from './shared-ui';
import { TOAST_ERROR_MS, TOAST_MS } from '@/components/ui/hot-toast';

/** GL-02: the ZIP toast uses the shared timings. */
describe('zipToastDuration', () => {
  const base = { name: 'Docs.zip', total: 3, n: 0 };

  it('stays open while the ZIP is built', () => {
    expect(zipToastDuration({ ...base, done: false })).toBe(Infinity);
  });

  it('closes after 3 seconds when done or a link was copied, 6 for an error', () => {
    expect(zipToastDuration({ ...base, done: true })).toBe(TOAST_MS);
    expect(zipToastDuration({ ...base, done: true, copy: true })).toBe(TOAST_MS);
    expect(zipToastDuration({ ...base, done: true, error: 'No files to download yet' })).toBe(TOAST_ERROR_MS);
  });
});
