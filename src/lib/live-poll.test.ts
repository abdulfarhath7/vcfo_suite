import { describe, expect, it } from 'vitest';
import { LIVE_POLL_MS, fingerprintHead, shouldInvalidateOnHeadChange } from '@/lib/live-poll';
import { NOTIFICATION_LIVE_POLL_MS } from '@/lib/notification-popup';

describe('live poll head', () => {
  it('fingerprints the cheap inbox/board signal', () => {
    expect(fingerprintHead(['a', 2, null])).toBe('a|2|');
  });

  it('does not refetch the full list on the first head', () => {
    expect(shouldInvalidateOnHeadChange(undefined, 'a|1')).toBe(false);
  });

  it('refetches only when the head actually changes', () => {
    expect(shouldInvalidateOnHeadChange('a|1', 'a|1')).toBe(false);
    expect(shouldInvalidateOnHeadChange('a|1', 'b|1')).toBe(true);
  });

  it('stays on the same cadence as the notification popup constant', () => {
    expect(LIVE_POLL_MS).toBe(NOTIFICATION_LIVE_POLL_MS);
    expect(LIVE_POLL_MS).toBe(4_000);
  });
});
