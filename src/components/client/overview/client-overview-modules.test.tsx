import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';

import { buildProgress, type ClientOverview } from '@/lib/client-overview';
import { ClientOverviewHero } from '@/components/client/overview/ClientOverviewHero';
import { ClientNextAction } from '@/components/client/overview/ClientNextAction';
import { ClientPhaseBars } from '@/components/client/overview/ClientPhaseBars';
import { ClientBallInCourt } from '@/components/client/overview/ClientBallInCourt';
import { ClientJourneyTrack } from '@/components/client/overview/ClientJourneyTrack';
import { ClientComplianceRunway } from '@/components/client/overview/ClientComplianceRunway';
import { ClientDeliverables } from '@/components/client/overview/ClientDeliverables';
import { ClientEntityCard } from '@/components/client/overview/ClientEntityCard';
import { ClientTeamCard } from '@/components/client/overview/ClientTeamCard';
import { ClientActivityFeed } from '@/components/client/overview/ClientActivityFeed';
import { buildMilestones } from '@/lib/client-overview';

function draw(ui: React.ReactElement) {
  return render(<LazyMotion features={domAnimation}>{ui}</LazyMotion>);
}

const preCoi: ClientOverview = {
  engagement: {
    id: 'e1',
    slug: 'acme-india',
    companyName: 'Acme India Private Limited',
    legalForm: 'company',
    domesticOrForeign: 'foreign',
    stage: 'Pre-Incorporation',
    startDate: '2026-01-05T00:00:00.000Z',
    parentEntityName: 'Acme Holdings LLC',
  },
  identifiers: {},
  incorporated: false,
  progress: buildProgress({}),
  nextAction: {
    stepId: 'pre-1',
    title: 'Client Details',
    href: '/app/client/incorporation?step=pre-1',
    description: 'Share your parent entity details and director KYC.',
    dueLabel: '2–3 working days',
    needsCorrection: false,
  },
  ballInCourt: { waitingOnClient: 1, waitingOnFirm: 0 },
  documents: { deliverables: [], counts: { requested: 1, submitted: 0, delivered: 0 } },
  compliance: { upcoming: [] },
  milestones: buildMilestones({}),
  activity: [],
  team: [],
};

const postCoi: ClientOverview = {
  ...preCoi,
  engagement: {
    ...preCoi.engagement,
    stage: 'Post-Incorporation',
    incorporationDate: '2026-04-01',
    registeredOffice: '4th Floor, Prestige Tower, Bengaluru 560001',
  },
  identifiers: { cin: 'U74999KA2026PTC123456', pan: 'AAACA1234A', tan: 'BLRA12345B' },
  incorporated: true,
  nextAction: undefined,
  ballInCourt: { waitingOnClient: 0, waitingOnFirm: 3 },
  documents: {
    deliverables: [
      {
        id: 'pre-12:certificateOfIncorporationFinalUrl',
        name: 'Certificate of Incorporation',
        kind: 'certificate',
        stepId: 'pre-12',
        storagePath: 'eng/coi/1-coi.pdf',
        issuedAt: '2026-04-02T10:00:00.000Z',
      },
    ],
    counts: { requested: 0, submitted: 4, delivered: 1 },
  },
  compliance: {
    upcoming: [
      {
        id: 'ci-1',
        title: 'GSTR-3B',
        authority: 'GST',
        group: 'GST',
        dueDate: '2026-09-20',
        status: 'upcoming',
        periodLabel: 'Aug 2026',
      },
      {
        id: 'ci-2',
        title: 'TDS Payment',
        authority: 'IT',
        group: 'Income tax',
        dueDate: '2026-09-07',
        status: 'upcoming',
      },
    ],
  },
  activity: [
    { id: 'a1', at: '2026-04-02T10:00:00.000Z', label: 'Certificate of Incorporation delivered' },
  ],
  team: [
    { id: 'u1', name: 'Pranay Kumar', email: 'pranay@example.com', role: 'Project Manager' },
    { id: 'u2', name: 'Sasi Kumar', email: 'sasi@example.com', role: 'Project Lead' },
  ],
};

describe('ClientOverviewHero', () => {
  it('leads with the company name and the pre-COI state line', () => {
    draw(<ClientOverviewHero overview={preCoi} />);

    expect(
      screen.getByRole('heading', { name: 'Acme India Private Limited' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/We are getting Acme India Private Limited started\./)).toBeInTheDocument();
    expect(screen.getByText('Foreign parent')).toBeInTheDocument();
  });

  it('switches to the post-COI mood', () => {
    draw(<ClientOverviewHero overview={postCoi} />);

    expect(
      screen.getByText(/COI issued — now in SPICe\+ Part A \(0 of 5 steps\)/),
    ).toBeInTheDocument();
  });

  it('carries the four key numbers in the hero strip, each linking to its screen', () => {
    draw(<ClientOverviewHero overview={postCoi} />);

    expect(screen.getByRole('link', { name: /Awaiting you/ })).toHaveAttribute(
      'href',
      '/app/client/inbox',
    );
    expect(screen.getByRole('link', { name: /Documents/ })).toHaveAttribute(
      'href',
      '/app/client/documents',
    );
    expect(screen.getByRole('link', { name: /Next deadline/ })).toHaveAttribute(
      'href',
      '/app/client/compliances',
    );
    expect(screen.getByRole('link', { name: /Complete/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation',
    );
    // The first upcoming filing's due date, formatted en-IN ("20 Sep"/"20 Sept").
    expect(screen.getByText(/^20 Sept?$/)).toBeInTheDocument();
  });

  it('shows an em dash rather than a fake date when no filing is due', () => {
    draw(<ClientOverviewHero overview={preCoi} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('ClientNextAction', () => {
  it('names the step and deep-links into the gated flowchart', () => {
    draw(<ClientNextAction nextAction={preCoi.nextAction} />);

    expect(screen.getByText('We need this from you')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open this step/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-1',
    );
  });

  it('shows the correction note and a resubmit CTA when work came back', () => {
    draw(
      <ClientNextAction
        nextAction={{ ...preCoi.nextAction!, needsCorrection: true, correctionNote: 'Passport unreadable.' }}
      />,
    );

    expect(screen.getByText('Corrections needed')).toBeInTheDocument();
    expect(screen.getByText('Passport unreadable.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fix & resubmit/ })).toBeInTheDocument();
  });

  it('states the all-clear without explaining it', () => {
    draw(<ClientNextAction nextAction={undefined} />);

    expect(screen.getByText(/You’re all set/)).toBeInTheDocument();
    // The surface says what is true, not why — no paragraph under the headline.
    expect(screen.queryByText(/with your VCFO team/)).toBeNull();
  });
});

describe('ClientPhaseBars', () => {
  it('renders the four phases with real counts', () => {
    draw(<ClientPhaseBars progress={preCoi.progress} />);

    // Each phase is named twice: on its bar, and in the colour key below it.
    expect(screen.getAllByText('SPICe+ Part A')).toHaveLength(2);
    expect(screen.getAllByText('Registration')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'SPICe+ Part A: 0% complete' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See every step' })).toHaveAttribute(
      'href',
      '/app/client/incorporation',
    );
  });
});

describe('ClientBallInCourt', () => {
  it('splits the open work between the client and the firm', () => {
    draw(<ClientBallInCourt waitingOnClient={1} waitingOnFirm={3} />);

    expect(screen.getByText('Waiting on you')).toBeInTheDocument();
    expect(screen.getByText('Waiting on us')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 waiting on you, 3 waiting on us' })).toBeInTheDocument();
  });

  it('is calm when nothing is open on either side', () => {
    draw(<ClientBallInCourt waitingOnClient={0} waitingOnFirm={0} />);
    expect(screen.getByText(/Nothing is open on either side/)).toBeInTheDocument();
  });
});

describe('ClientJourneyTrack', () => {
  it('shows curated stations and marks upcoming ones as upcoming, never denied', () => {
    draw(<ClientJourneyTrack milestones={preCoi.milestones} />);

    expect(screen.getByText('Company details')).toBeInTheDocument();
    expect(screen.getByText('Certificate of Incorporation')).toBeInTheDocument();
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
    expect(screen.queryByText(/denied/i)).toBeNull();
    // Read-only: no link may escape into a step from this track.
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('ClientComplianceRunway', () => {
  it('explains the empty runway before incorporation instead of drawing a fake series', () => {
    draw(<ClientComplianceRunway upcoming={[]} incorporated={false} />);
    expect(screen.getByText(/Your filing calendar starts the day/)).toBeInTheDocument();
  });

  it('groups real filings by authority and lists what is coming up', () => {
    draw(<ClientComplianceRunway upcoming={postCoi.compliance.upcoming} incorporated />);

    // Each group is named twice: once on its bar, once beside the filing it
    // owns in "Coming up" — colour alone must not carry the identification.
    expect(screen.getAllByText('GST')).toHaveLength(2);
    expect(screen.getAllByText('Income tax')).toHaveLength(2);
    expect(screen.getByText(/GSTR-3B/)).toBeInTheDocument();
  });
});

describe('ClientDeliverables', () => {
  it('offers an honest empty state when nothing has been issued', () => {
    draw(<ClientDeliverables documents={preCoi.documents} />);
    expect(screen.getByText('No certificates issued yet')).toBeInTheDocument();
  });

  it('lists issued certificates and totals them in the donut', () => {
    draw(<ClientDeliverables documents={postCoi.documents} />);

    expect(screen.getByText('Certificate of Incorporation')).toBeInTheDocument();
    const figure = screen.getByRole('figure');
    expect(within(figure).getByText('5')).toBeInTheDocument(); // 1 issued + 4 received
    expect(within(figure).getByText('Issued to you')).toBeInTheDocument();
  });
});

describe('ClientEntityCard', () => {
  it('presents the statutory identifiers as an ID card', () => {
    draw(
      <ClientEntityCard engagement={postCoi.engagement} identifiers={postCoi.identifiers} />,
    );

    expect(screen.getByText('Registered entity')).toBeInTheDocument();
    expect(screen.getByText('U74999KA2026PTC123456')).toBeInTheDocument();
    expect(screen.getByText('BLRA12345B')).toBeInTheDocument();
    expect(screen.getByText(/Prestige Tower/)).toBeInTheDocument();
  });

  it('renders nothing when there is no identity to show', () => {
    const { container } = draw(
      <ClientEntityCard engagement={preCoi.engagement} identifiers={{}} />,
    );
    expect(container.querySelector('.client-idcard')).toBeNull();
  });
});

describe('ClientTeamCard', () => {
  it('names the firm-side team without ever using the word intern', () => {
    const { container } = draw(
      <ClientTeamCard team={postCoi.team} companyName="Acme India Private Limited" />,
    );

    expect(screen.getByText('Pranay Kumar')).toBeInTheDocument();
    expect(screen.getByText('Project Lead')).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain('intern');
  });

  it('falls back to the firm address when nobody is assigned yet', () => {
    draw(<ClientTeamCard team={[]} companyName="Acme India Private Limited" />);
    expect(screen.getByRole('link', { name: 'info@vcfosuite.com' })).toBeInTheDocument();
  });
});

describe('ClientActivityFeed', () => {
  it('shows recent scoped audit lines', () => {
    draw(<ClientActivityFeed activity={postCoi.activity} />);
    expect(screen.getByText('Certificate of Incorporation delivered')).toBeInTheDocument();
  });

  it('explains the empty feed', () => {
    draw(<ClientActivityFeed activity={[]} />);
    expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument();
  });
});
