export type GenieBox = { left: number; top: number; width: number; height: number };

/** End the flight as a disc in the middle of the dock target, not beside it. */
export function measureGenieDock(
  from: GenieBox,
  to: GenieBox,
): { from: GenieBox; to: GenieBox } {
  const size = Math.max(5, Math.min(to.width, to.height) * 0.38);
  return {
    from: { left: from.left, top: from.top, width: from.width, height: from.height },
    to: {
      left: to.left + (to.width - size) / 2,
      top: to.top + (to.height - size) / 2,
      width: size,
      height: size,
    },
  };
}
