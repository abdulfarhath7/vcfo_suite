import { describe, expect, it } from 'vitest';
import { itemKey, parseItemKey } from './item-key';

describe('item keys', () => {
  it('round-trips every kind', () => {
    const refs = [
      { kind: 'step', engagementId: 'e1', stepId: 's7' },
      { kind: 'filing', id: 'f1' },
      { kind: 'event', id: 'v1' },
      { kind: 'request', id: 'r1' },
      { kind: 'task', id: 't1' },
    ] as const;
    for (const ref of refs) expect(parseItemKey(itemKey(ref))).toEqual(ref);
  });

  it('rejects unknown or malformed keys', () => {
    expect(parseItemKey('step:e1')).toBeNull();
    expect(parseItemKey('filing:a:b')).toBeNull();
    expect(parseItemKey('other:x')).toBeNull();
  });
});
