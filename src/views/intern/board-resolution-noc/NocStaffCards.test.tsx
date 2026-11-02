import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildNocState, type NocRowInput } from '@/lib/noc/state';
import { NocReceiveCard, NocTemplateCard, NocWhyCard } from '@/views/intern/board-resolution-noc/NocStaffCards';

/**
 * Spec section 7 (staff): Accept stays disabled until every receive check is ticked, and Send back
 * cannot go without a reason. The template card shows the internal file name and the out-of-date
 * mark; Change template is offered only to a manager or admin.
 */

const indian = { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'investing', parentEntityName: 'Parent Ltd' };
const foreign = { ownershipType: 'subsidiary', companyType: 'foreign', parentIndianRelationship: null, parentEntityName: 'Parent Inc.' };
const row: NocRowInput = {
  status: 'finalized',
  storagePath: 'br/x.docx',
  finalizedAt: '2026-10-02T00:00:00.000Z',
  signedStoragePath: 'br/signed.pdf',
  signedUploadedAt: '2026-10-03T00:00:00.000Z',
};
const tick = { by: 'u', at: '2026-10-04T00:00:00.000Z' };

function state(r: NocRowInput, answers = indian, canChangeTemplate = true) {
  return buildNocState({ row: r, answers, names: new Map(), viewer: { staff: true, canChangeTemplate } });
}

describe('NocReceiveCard', () => {
  it('keeps Accept disabled until every check is ticked', () => {
    const act = vi.fn();
    const three = state({ ...row, receiveChecks: { director_signature: tick, date_place: tick, letterhead: tick } });
    const { rerender } = render(<NocReceiveCard noc={three} busy={null} act={act} hasSignedCopy onAccepted={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByText('3 of 4')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(true);

    const all = state({ ...row, receiveChecks: { director_signature: tick, date_place: tick, letterhead: tick, names_match: tick } });
    rerender(<NocReceiveCard noc={all} busy={null} act={act} hasSignedCopy onAccepted={vi.fn()} onError={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows six checks for a foreign parent', () => {
    render(<NocReceiveCard noc={state(row, foreign)} busy={null} act={vi.fn()} hasSignedCopy onAccepted={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByText('0 of 6')).toBeTruthy();
    expect(screen.getByText('Notary stamp')).toBeTruthy();
    expect(screen.getByText('Apostille certificate')).toBeTruthy();
  });

  it('needs a reason to send back, then sends it', () => {
    const act = vi.fn().mockResolvedValue(state(row));
    render(<NocReceiveCard noc={state(row)} busy={null} act={act} hasSignedCopy onAccepted={vi.fn()} onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    const send = screen.getAllByRole('button', { name: 'Send back' }).at(-1) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'No seal' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Send back' }).at(-1)!);
    expect(act).toHaveBeenCalledWith({ action: 'send_back', reason: 'No seal' });
  });

  it('is hidden until a signed copy exists', () => {
    const { container } = render(
      <NocReceiveCard noc={state({ ...row, signedStoragePath: null })} busy={null} act={vi.fn()} hasSignedCopy={false} onAccepted={vi.fn()} onError={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('NocTemplateCard', () => {
  const props = { busy: null, act: vi.fn(), onMakeAgain: vi.fn(), makingAgain: false, loadVersions: vi.fn().mockResolvedValue([]), onError: vi.fn() };

  it('shows the variant and the internal file name, and Change template for a manager or admin', () => {
    render(<NocTemplateCard noc={state(row)} {...props} />);
    expect(screen.getByText('NOC — Indian subsidiary (investing)')).toBeTruthy();
    expect(screen.getByText('noc-indian-investing.docx')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change template' })).toBeTruthy();
  });

  it('hides Change template from a lead', () => {
    render(<NocTemplateCard noc={state(row, indian, false)} {...props} />);
    expect(screen.queryByRole('button', { name: 'Change template' })).toBeNull();
  });

  it('marks the draft out of date and offers to make it again', () => {
    const noc = buildNocState({
      row,
      answers: indian,
      names: new Map(),
      latestVersion: { version: 1, fields: { PARENT_ENTITY_NAME: 'Old Ltd' } },
      currentFields: { PARENT_ENTITY_NAME: 'Parent Ltd' },
      viewer: { staff: true, canChangeTemplate: true },
    });
    const onMakeAgain = vi.fn();
    render(<NocTemplateCard noc={noc} {...props} onMakeAgain={onMakeAgain} />);
    expect(screen.getByText('Answers changed after release')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Make the draft again' }));
    expect(onMakeAgain).toHaveBeenCalled();
  });
});

describe('NocWhyCard', () => {
  it('shows staff the same full tree as the client, with the chosen path lit (D5)', () => {
    const { container } = render(<NocWhyCard noc={state(row, foreign)} />);
    expect(screen.getByRole('img', { name: /Decision tree/ })).toBeInTheDocument();
    expect(container.querySelector('[data-node="noc-foreign"][data-on="1"] [data-testid="noc-chosen"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-node]')).toHaveLength(13);
    expect(screen.getByRole('button', { name: 'Replay the chosen path' })).toBeInTheDocument();
    expect(screen.getByText('Project setup · Ownership type')).toBeInTheDocument();
  });
});
