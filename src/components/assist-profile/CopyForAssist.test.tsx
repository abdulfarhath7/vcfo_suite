import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAssistProfile } from '@/lib/assist-profile/build';
import { assistFullState, NR } from '@/lib/assist-profile/__tests__/fixtures';
import { director } from '@/lib/doc-pack/__tests__/fixtures';
import { buildDocPackContext } from '@/lib/doc-pack/evaluate';
import type { AssistProfileResult } from '@/lib/assist-profile/types';
import type { EngagementChecklistState } from '@/lib/engagements-db';

let data: AssistProfileResult | undefined;
const refetch = vi.fn(async () => ({ data }));

vi.mock('@/hooks/use-assist-profile', () => ({
  useAssistProfile: () => ({ data, isPending: false, isError: false, error: null, refetch }),
}));
const toastSuccess = vi.fn();
vi.mock('@/lib/toast-errors', () => ({
  toastSuccess: (...args: unknown[]) => toastSuccess(...args),
  toastError: vi.fn(),
  errorMessage: (_e: unknown, fallback = 'error') => fallback,
}));

const { CopyForAssist } = await import('@/components/assist-profile/CopyForAssist');

const hrefForMissing = (input: { stepId: string; tabId?: string }) =>
  `/step/${input.stepId}${input.tabId ? `?tab=${input.tabId}` : ''}`;

const resultFor = (state: EngagementChecklistState) =>
  buildAssistProfile(buildDocPackContext({ state, engagement: { companyName: 'Test Company India Private Limited' } }));

beforeEach(() => {
  toastSuccess.mockClear();
  refetch.mockClear();
});

describe('CopyForAssist', () => {
  it('a full engagement shows nothing missing, in the success tone', () => {
    data = resultFor(assistFullState());
    render(<CopyForAssist engagementId="eng-1" hrefForMissing={hrefForMissing} />);
    const chip = screen.getByText('Nothing missing');
    expect(chip.className).toContain('bg-success-light');
    expect(screen.getByText(/fields? Suite cannot supply/)).toBeInTheDocument();
  });

  it('counts blank Suite fields in the waiting tone and links each to its step and tab', () => {
    const noPan = director('e2', 'yes', 'Beta', {
      panNumber: '',
      gender: 'male',
      occupationType: 'business',
      highestEducationalQualification: 'bachelors-degree',
    });
    data = resultFor(assistFullState([NR, noPan]));
    render(<CopyForAssist engagementId="eng-1" hrefForMissing={hrefForMissing} />);
    expect(screen.getByText('1 missing').className).toContain('bg-warning-light');
    fireEvent.click(screen.getByRole('button', { name: /show details/i }));
    expect(screen.getByRole('link', { name: /Director 2 · PAN/ })).toHaveAttribute('href', '/step/pre-15?tab=directors');
    expect(screen.getByText(/Pick the NIC row/)).toBeInTheDocument();
  });

  it('copies the profile JSON, and only the profile, to the clipboard', async () => {
    data = resultFor(assistFullState());
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyForAssist engagementId="eng-1" hrefForMissing={hrefForMissing} />);
    fireEvent.click(screen.getByRole('button', { name: /copy for assist/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = JSON.parse(writeText.mock.calls[0]![0]);
    expect(copied).toEqual(data!.profile);
    expect(copied.mcaLogin).toEqual({ userId: '' });
    expect(toastSuccess).toHaveBeenCalledWith('Profile copied for Assist', 'Paste it into VCFO Assist.');
  });
});
