import { describe, expect, it } from 'vitest';
import {
  tabStripHorizontalDelta,
  tabStripOverflowState,
  tabStripScrollChunk,
} from '@/views/incorporation/intern-section-tab-strip';

describe('tabStripHorizontalDelta', () => {
  it('uses vertical delta when the wheel is mostly vertical', () => {
    expect(tabStripHorizontalDelta(0, 80)).toBe(80);
    expect(tabStripHorizontalDelta(12, -40)).toBe(-40);
  });

  it('keeps native horizontal delta when the gesture is already sideways', () => {
    expect(tabStripHorizontalDelta(50, 10)).toBe(50);
  });
});

describe('tabStripOverflowState', () => {
  it('hides both directions when content fits', () => {
    expect(tabStripOverflowState(0, 320, 320)).toEqual({
      overflowing: false,
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it('enables right at the start and left at the end', () => {
    expect(tabStripOverflowState(0, 800, 320)).toEqual({
      overflowing: true,
      canScrollLeft: false,
      canScrollRight: true,
    });
    expect(tabStripOverflowState(480, 800, 320)).toEqual({
      overflowing: true,
      canScrollLeft: true,
      canScrollRight: false,
    });
    expect(tabStripOverflowState(120, 800, 320)).toEqual({
      overflowing: true,
      canScrollLeft: true,
      canScrollRight: true,
    });
  });
});

describe('tabStripScrollChunk', () => {
  it('uses the first tab width when available', () => {
    expect(tabStripScrollChunk(176)).toBe(176);
    expect(tabStripScrollChunk(undefined)).toBe(200);
    expect(tabStripScrollChunk(0)).toBe(200);
  });
});
