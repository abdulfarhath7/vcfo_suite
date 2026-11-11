import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChecklistField } from '@/data/checklist';
import { DirectorGrid, DirectorViewToggle } from './DirectorGrid';

const text = (id: string, label: string): ChecklistField => ({ id, label, type: 'text' }) as ChecklistField;
const columns = [
  { id: 'firstName', label: 'First Name', field: text('firstName', 'First Name') },
  { id: 'passportNumber', label: 'Passport number', field: text('passportNumber', 'Passport number') },
];
const rows = ['e1', 'e2'].map((id, i) => ({
  key: id,
  title: `Director ${i + 1}`,
  cellKey: (col: string) => `directors.${id}.${col}`,
  shown: (col: string) => !(id === 'e1' && col === 'passportNumber'),
}));

describe('CD-03 / SB-02 director grid', () => {
  it('shows one row per director and one column per question, editing the same answers', () => {
    const onChange = vi.fn();
    render(
      <DirectorGrid
        rows={rows}
        columns={columns}
        values={{ 'directors.e1.firstName': 'Asha' }}
        readOnly={(key) => key.endsWith('e2.firstName')}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('columnheader', { name: /Passport number/ })).toBeInTheDocument();
    const cell = screen.getByLabelText('First Name · Director 1') as HTMLInputElement;
    expect(cell.value).toBe('Asha');
    fireEvent.change(cell, { target: { value: 'Asha R' } });
    expect(onChange).toHaveBeenCalledWith('directors.e1.firstName', 'Asha R');
    // A hidden question has no input; a read-only cell is disabled.
    expect(screen.queryByLabelText('Passport number · Director 1')).toBeNull();
    expect(screen.getByLabelText('First Name · Director 2')).toBeDisabled();
    // The name column stays in view while the grid scrolls sideways.
    expect(screen.getByRole('rowheader', { name: /Director 1/ }).className).toContain('sticky');
  });

  it('switches between Cards and Grid', () => {
    const onChange = vi.fn();
    render(<DirectorViewToggle view="cards" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /Grid/ }));
    expect(onChange).toHaveBeenCalledWith('grid');
  });
});
