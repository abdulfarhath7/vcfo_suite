/** Map a wheel gesture to horizontal tab-strip scroll (vertical-dominant → scrollLeft). */
export function tabStripHorizontalDelta(deltaX: number, deltaY: number): number {
  return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
}

export function tabStripOverflowState(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): { overflowing: boolean; canScrollLeft: boolean; canScrollRight: boolean } {
  const max = Math.max(0, scrollWidth - clientWidth);
  return {
    overflowing: max > 1,
    canScrollLeft: scrollLeft > 1,
    canScrollRight: scrollLeft < max - 1,
  };
}

/** Arrow buttons step by one tab width, or 200px when the first tab is unknown. */
export function tabStripScrollChunk(firstTabWidth: number | undefined, fallback = 200): number {
  if (typeof firstTabWidth === 'number' && firstTabWidth > 0) return firstTabWidth;
  return fallback;
}
