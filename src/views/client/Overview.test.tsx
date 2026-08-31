import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';

import { buildMilestones, buildProgress, type ClientOverview } from '@/lib/client-overview';

const useClientOverview = vi.fn();

vi.mock('@/lib/use-client-overview', () => ({
  useClientOverview: () => useClientOverview(),
}));

/** The shell appearance hook reads localStorage + matchMedia; a stub keeps this a unit test. */
vi.mock('@/lib/use-shell-appearance', () => ({
  useShellAppearance: () => ({
    hero: {},
    motion: 'default',
    reduceMotion: true,
    prefs: { motion: 'default' },
  }),
}));

const { default: ClientOverviewView } = await import('@/views/client/Overview');

const base: ClientOverview = {
  engagement: {
    id: 'e1',
    slug: 'acme-india',
    companyName: 'Acme India Private Limited',
    legalForm: 'company',
    domesticOrForeign: 'foreign',
    stage: 'Pre-Incorporation',
    startDate: '2026-01-05T00:00:00.000Z',
  },
  identifiers: {},
  incorporated: false,
  progress: buildProgress({}),
  nextAction: {
    stepId: 'pre-1',
    title: 'Client Details',
    href: '/app/client/incorporation?step=pre-1',
    needsCorrection: false,
  },
  ballInCourt: { waitingOnClient: 1, waitingOnFirm: 0 },
  documents: { deliverables: [], counts: { requested: 1, submitted: 0, delivered: 0 } },
  compliance: { upcoming: [] },
  milestones: buildMilestones({}),
  activity: [],
  team: [],
};

function draw() {
  return render(
    <LazyMotion features={domAnimation}>
      <ClientOverviewView />
    </LazyMotion>,
  );
}

function ok(overview: ClientOverview) {
  return {
    data: { overview, missing: false },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('client Overview', () => {
  it('shows brand skeletons while loading, never the boot screen', () => {
    useClientOverview.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    });

    const { container } = draw();

    expect(screen.getByLabelText('Loading your dashboard')).toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton-brand').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Opening VCFO Suite/i)).toBeNull();
  });

  it('offers a retry when the scoped read fails', () => {
    const refetch = vi.fn();
    useClientOverview.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Could not load your dashboard'),
      refetch,
      isFetching: false,
    });

    draw();
    expect(screen.getByText('We could not load your dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders an honest empty state when the client has no engagement', () => {
    useClientOverview.mockReturnValue({
      data: { overview: null, missing: true },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    draw();
    expect(screen.getByText('No active engagement')).toBeInTheDocument();
  });

  it('pre-COI: leads with progress and keeps the entity card off the page', () => {
    useClientOverview.mockReturnValue(ok(base));

    const { container } = draw();

    expect(screen.getByRole('heading', { name: 'Acme India Private Limited' })).toBeInTheDocument();
    expect(screen.getByText('We need this from you')).toBeInTheDocument();
    expect(container.querySelector('.client-idcard')).toBeNull();
    expect(screen.getByText(/Your filing calendar starts the day/)).toBeInTheDocument();
  });

  it('post-COI: raises the entity ID card and the compliance runway above progress', () => {
    useClientOverview.mockReturnValue(
      ok({
        ...base,
        incorporated: true,
        identifiers: { cin: 'U74999KA2026PTC123456' },
        engagement: { ...base.engagement, incorporationDate: '2026-04-01' },
        nextAction: undefined,
        ballInCourt: { waitingOnClient: 0, waitingOnFirm: 2 },
      }),
    );

    const { container } = draw();

    const idCard = container.querySelector('.client-idcard');
    const phaseBars = screen.getByText('Where we are');
    expect(idCard).not.toBeNull();
    // Document order decides the mood: identity sits above the phase bars.
    expect(idCard!.compareDocumentPosition(phaseBars)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText(/You’re all set/)).toBeInTheDocument();
  });

  it('never exposes the code role word "intern" to a client', () => {
    useClientOverview.mockReturnValue(
      ok({
        ...base,
        team: [{ id: 'u1', name: 'Sasi Kumar', email: 's@example.com', role: 'Project Lead' }],
      }),
    );

    const { container } = draw();
    expect(container.textContent?.toLowerCase()).not.toContain('intern');
  });

  it('links every actionable element into the screen that owns it', () => {
    useClientOverview.mockReturnValue(ok(base));

    draw();

    expect(screen.getByRole('link', { name: /Open this step/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-1',
    );
    expect(screen.getByRole('link', { name: 'All documents' })).toHaveAttribute(
      'href',
      '/app/client/documents',
    );
    expect(screen.getByRole('link', { name: 'All filings' })).toHaveAttribute(
      'href',
      '/app/client/compliances',
    );
    expect(screen.getByRole('link', { name: 'Full log' })).toHaveAttribute(
      'href',
      '/app/client/audit',
    );
  });
});
