/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedViews } from './saved-views';
import { readSavedViews, savedViewsKey, type SavedView } from '@/lib/ui/table-prefs';

const views: SavedView[] = [
  { key: 'all', label: 'All', filters: {} },
  { key: 'overdue', label: 'My overdue', filters: { status: 'Overdue' } },
];

beforeEach(() => window.localStorage.clear());

describe('SavedViews', () => {
  it('picks the view that matches the filters and applies a view on click', () => {
    const onApply = vi.fn();
    render(<SavedViews storageKey="manager:work" views={views} current={{ status: 'Overdue' }} onApply={onApply} />);
    expect(screen.getByRole('tab', { name: 'My overdue' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /Save view/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(onApply).toHaveBeenCalledWith({});
  });

  it('saves the current filters under a name and removes a picked saved view', () => {
    const { rerender } = render(<SavedViews storageKey="manager:work" views={views} current={{ area: 'gst' }} onApply={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Save view/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), { target: { value: 'GST only' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save view' }).at(-1)!);
    expect(readSavedViews('manager:work')).toMatchObject([{ label: 'GST only', filters: { area: 'gst' } }]);
    expect(screen.getByRole('tab', { name: 'GST only' })).toHaveAttribute('aria-selected', 'true');

    rerender(<SavedViews storageKey="manager:work" views={views} current={{ area: 'gst' }} onApply={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove view GST only' }));
    expect(readSavedViews('manager:work')).toEqual([]);
    expect(window.localStorage.getItem(savedViewsKey('manager:work'))).toBe('[]');
  });
});
