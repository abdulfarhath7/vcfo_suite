import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSaved = vi.fn((..._a: unknown[]) => 'saved-id');
const toastUndo = vi.fn((..._a: unknown[]) => 'undo-id');
vi.mock('@/components/ui/toast-saved', () => ({ toastSaved: (...a: unknown[]) => toastSaved(...a) }));
vi.mock('@/components/ui/undo-toast', () => ({ toastUndo: (...a: unknown[]) => toastUndo(...a) }));

import { showPortalToast } from './portal-toast';

/** GL-02: the client portal's toast goes through the shared toaster. */
describe('showPortalToast', () => {
  beforeEach(() => {
    toastSaved.mockClear();
    toastUndo.mockClear();
  });

  it('sends a plain message to the shared dark line in the portal theme', () => {
    showPortalToast('Showing the company after incorporation', undefined, 'dark');
    expect(toastUndo).toHaveBeenCalledWith('Showing the company after incorporation', undefined, { action: undefined, theme: 'dark' });
    expect(toastSaved).not.toHaveBeenCalled();
  });

  it('sends a kind to the shared white toast with its second line and action', () => {
    const action = { label: 'View', onClick: () => {} };
    showPortalToast('Uploaded', { kind: 'uploaded', sub: 'PAN card', action }, 'light');
    expect(toastSaved).toHaveBeenCalledWith('Uploaded', { kind: 'uploaded', sub: 'PAN card', onUndo: undefined, action, theme: 'light' });
  });

  it('runs the undo and then confirms it with an "Undone" toast', () => {
    const undo = vi.fn();
    showPortalToast('Theme · Dark', { undo });
    const onUndo = toastUndo.mock.calls[0]![1] as () => void;
    onUndo();
    expect(undo).toHaveBeenCalledOnce();
    expect(toastUndo).toHaveBeenLastCalledWith('Undone', undefined, { theme: undefined });
  });
});
