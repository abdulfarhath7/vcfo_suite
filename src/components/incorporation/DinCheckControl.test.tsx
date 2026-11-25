import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DinCheckControl } from './DinCheckControl';

/**
 * DR-01 with the MCA lookup behind it: "Check with MCA" fetches the director master data for
 * the typed DIN and compares the name, but it records nothing by itself. The lead presses
 * Verified or Mismatch, as firm policy SBC-STD-AI-02 requires.
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const mcaRecord = {
  din: '06419899',
  name: 'AMEERUDDIN SYED',
  dinStatus: 'Approved',
  approveDate: '2013-01-01',
  dir3Kyc: 'Done',
  providerUpdatedAt: '',
  associations: [
    { cin: 'L72100TG1981PLC169991', companyName: 'MAGELLANIC CLOUD LIMITED', designation: 'Whole-time director', appointmentDate: '2026-02-03', entityType: 'company', companyStatus: 'Active', appointmentCategory: 'Professional', currentDesignationDate: '2026-02-03', cessationDate: '' },
    { cin: 'U72900TG2022PTC163495', companyName: 'ZILIKA TECHNOLOGIES PRIVATE LIMITED', designation: 'Director', appointmentDate: '2022-06-08', entityType: 'company', companyStatus: 'Active', appointmentCategory: '', currentDesignationDate: '', cessationDate: '2026-09-23' },
  ],
};

function values(extra: Record<string, string> = {}) {
  return {
    'directors.e1.hasDin': 'yes',
    'directors.e1.din': '06419899',
    'directors.e1.firstName': 'Ameeruddin',
    'directors.e1.lastName': 'Syed',
    ...extra,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('DinCheckControl, Check with MCA', () => {
  it('will not check until the DIN is eight digits', () => {
    render(<DinCheckControl values={values({ 'directors.e1.din': '0641' })} entryId="e1" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Check with MCA/ })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the record, says the name matches, and records nothing on its own', async () => {
    const onChange = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: mcaRecord }) });
    render(<DinCheckControl values={values()} entryId="e1" onChange={onChange} />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Check with MCA/ })); });

    await waitFor(() => expect(screen.getByText('AMEERUDDIN SYED')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/tools/din-lookup', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByText('Name matches')).toBeInTheDocument();
    // Only the standing appointment is counted; the ceased one is not.
    expect(screen.getByText(/1 current appointment on MCA: MAGELLANIC CLOUD LIMITED/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('records verified when the lead presses it', async () => {
    const onChange = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: mcaRecord }) });
    render(<DinCheckControl values={values()} entryId="e1" onChange={onChange} />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Check with MCA/ })); });
    await waitFor(() => expect(screen.getByText('Name matches')).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record as verified' })); });

    expect(onChange).toHaveBeenCalledWith('directors.e1.dinStatus', 'verified');
  });

  it('flags a different name and carries the difference into the mismatch note', async () => {
    const onChange = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: mcaRecord }) });
    render(<DinCheckControl values={values({ 'directors.e1.firstName': 'Rajesh', 'directors.e1.lastName': 'Kumar' })} entryId="e1" onChange={onChange} />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Check with MCA/ })); });
    await waitFor(() => expect(screen.getByText('Name differs')).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record as mismatch' })); });

    expect(onChange).toHaveBeenCalledWith('directors.e1.dinStatus', 'mismatch');
    expect(onChange).toHaveBeenCalledWith('directors.e1.dinMismatchNote', expect.stringContaining('AMEERUDDIN SYED'));
  });

  it('shows the route’s own message when the lookup fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ ok: false, error: 'MCA lookup is not configured.' }) });
    render(<DinCheckControl values={values()} entryId="e1" onChange={vi.fn()} />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Check with MCA/ })); });

    await waitFor(() => expect(screen.getByText('MCA lookup is not configured.')).toBeInTheDocument());
  });

  it('stays out of the way for a director who has no DIN yet', () => {
    render(<DinCheckControl values={{ 'directors.e1.hasDin': 'no' }} entryId="e1" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Check with MCA/ })).not.toBeInTheDocument();
  });
});
