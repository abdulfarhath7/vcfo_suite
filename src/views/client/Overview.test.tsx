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
  needs: [
    { stepId: 'pre-1', title: 'Client Details', action: 'fill', href: '/app/client/incorporation?step=pre-1' },
  ],
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

  it('pre-COI: leads with the path, the forming entity, and taxes', () => {
    useClientOverview.mockReturnValue(ok(base));

    const { container } = draw();

    expect(screen.getByRole('heading', { level: 1, name: 'Acme India Private Limited' })).toBeInTheDocument();
    expect(screen.queryByText(/the next step is yours/)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/your step right now/i);
    expect(screen.getByText('Needs from you')).toBeInTheDocument();
    expect(screen.getByText('Your entity')).toBeInTheDocument();
    expect(container.querySelector('.client-idcard')).toBeNull();
    expect(screen.getByText('Who holds it now')).toBeInTheDocument();
    expect(screen.getByText('Important alerts')).toBeInTheDocument();
    expect(screen.getByText('Taxes')).toBeInTheDocument();
    expect(screen.getAllByText('After incorporation').length).toBeGreaterThan(0);
  });

  it('post-COI: keeps the path, then the entity card and taxes', () => {
    useClientOverview.mockReturnValue(
      ok({
        ...base,
        incorporated: true,
        identifiers: { cin: 'U74999KA2026PTC123456' },
        engagement: { ...base.engagement, incorporationDate: '2026-04-01' },
        nextAction: undefined,
        needs: [],
        ballInCourt: { waitingOnClient: 0, waitingOnFirm: 2 },
      }),
    );

    const { container } = draw();

    const idCard = container.querySelector('.client-idcard');
    const phaseBars = screen.getByText('Where we are');
    expect(idCard).not.toBeNull();
    // The path comes first. The entity card follows it.
    expect(phaseBars.compareDocumentPosition(idCard!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Taxes')).toBeInTheDocument();
    expect(screen.getByText(/Nothing needed from you/)).toBeInTheDocument();
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

    expect(screen.getByRole('link', { name: /Fill in Client Details/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-1',
    );
    expect(screen.getByRole('link', { name: /Continue Client Details/ })).toHaveAttribute(
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
  });
});
