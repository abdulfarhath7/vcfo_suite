import { describe, expect, it } from 'vitest';
import { fadeOpacity, sidebarPanelStagger, springSnappy } from '@/lib/motion';
import { sidebarHoverIdFromNode } from '@/components/shell/MotionActivePill';

describe('sidebarHoverIdFromNode', () => {
  it('reads data-sidebar-hover from the node or a parent', () => {
    const wrap = document.createElement('div');
    wrap.dataset.sidebarHover = 'today';
    const child = document.createElement('span');
    wrap.appendChild(child);
    expect(sidebarHoverIdFromNode(child)).toBe('today');
    expect(sidebarHoverIdFromNode(wrap)).toBe('today');
    expect(sidebarHoverIdFromNode(document.createElement('div'))).toBeNull();
    expect(sidebarHoverIdFromNode(null)).toBeNull();
  });
});

describe('sidebar motion presets', () => {
  it('keeps snappy springs for layoutId pills', () => {
    expect(springSnappy).toMatchObject({ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 });
  });

  it('staggers disclosure children with opacity only', () => {
    expect(fadeOpacity.hidden).toEqual({ opacity: 0 });
    expect('y' in (fadeOpacity.hidden as object)).toBe(false);
    expect(sidebarPanelStagger.show).toBeTruthy();
  });
});
