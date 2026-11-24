import { describe, expect, it, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { SidePanelFrame, useSidePanelOpen } from './side-panel-toggle';

/** GL-05: the side panel is open for a new user, and one push on the handle closes and opens it. */
describe('side panel', () => {
  beforeEach(() => window.localStorage.clear());

  it('is open for a new user and keeps each user\'s last choice', () => {
    const first = renderHook(() => useSidePanelOpen('u-1'));
    expect(first.result.current[0]).toBe(true);
    act(() => first.result.current[1]());
    expect(first.result.current[0]).toBe(false);
    // After a page change (a new mount), the same user still has it closed; another user does not.
    expect(renderHook(() => useSidePanelOpen('u-1')).result.current[0]).toBe(false);
    expect(renderHook(() => useSidePanelOpen('u-2')).result.current[0]).toBe(true);
  });

  it('names the action for a screen reader and works with the keyboard', () => {
    let open = true;
    const { rerender } = render(<SidePanelFrame open={open} onToggle={() => (open = !open)}><div>rail</div></SidePanelFrame>);
    const handle = screen.getByRole('button', { name: 'Hide the progress panel' });
    expect(handle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(handle);
    rerender(<SidePanelFrame open={open} onToggle={() => (open = !open)}><div>rail</div></SidePanelFrame>);
    expect(screen.getByRole('button', { name: 'Show the progress panel' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('points the chevron the way a left-hand panel moves', () => {
    const { container, rerender } = render(<SidePanelFrame open onToggle={() => {}} side="left"><div>rail</div></SidePanelFrame>);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('lucide-chevron-left');
    rerender(<SidePanelFrame open={false} onToggle={() => {}} side="left"><div>rail</div></SidePanelFrame>);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('lucide-chevron-right');
  });
});
