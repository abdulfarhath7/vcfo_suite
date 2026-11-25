import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChangesetRowView } from '@/lib/ask/changeset/view-types';
import { ChangesetRow } from './ChangesetRow';

const base: ChangesetRowView = {
  id: 'r1',
  stepId: 'pre-1',
  stepTitle: 'Client Details',
  label: 'Business description',
  displayOld: '',
  displayNew: 'The subsidiary will build a cloud platform.',
  sensitive: false,
  source: 'Quarry Board Resolution.docx, page 1',
  checks: [{ rule: 'documents_differ', ok: false, message: 'Quarry MOA.pdf says To develop software platforms.', choice: 'To develop software platforms.' }],
  status: 'proposed',
  heldReason: null,
  error: null,
  canDecide: true,
  canAccept: true,
  needsLook: true,
  editable: true,
  inputType: 'text',
  groupKey: 'values',
  groupTitle: 'Checklist values',
  groupKind: 'values',
  sourceFile: null,
};

const props = (row: ChangesetRowView, onSaveEdit = vi.fn()) => ({ row, open: true, pickable: true, accepted: false, editing: false, pending: false, onToggle: vi.fn(), onEdit: vi.fn(), onCancelEdit: vi.fn(), onSaveEdit });

describe('ChangesetRow, two documents differ (PLAN M)', () => {
  it('shows the other document and takes its value with one press', () => {
    const onSaveEdit = vi.fn();
    render(<ChangesetRow {...props(base, onSaveEdit)} />);
    expect(screen.getByText('Quarry MOA.pdf says To develop software platforms.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
    expect(onSaveEdit).toHaveBeenCalledWith('To develop software platforms.');
  });

  it('offers no choice on a row that cannot be edited', () => {
    render(<ChangesetRow {...props({ ...base, editable: false })} />);
    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull();
  });
});
