import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';

import { buildCompanySnapshot, buildProgress, type ClientOverview } from '@/lib/client-overview';
import { ClientOverviewHero } from '@/components/client/overview/ClientOverviewHero';
import { ClientNeeds } from '@/components/client/overview/ClientNeeds';
import { ClientPhaseBars } from '@/components/client/overview/ClientPhaseBars';
import { ClientWhoHolds } from '@/components/client/overview/ClientWhoHolds';
import { ClientAlerts } from '@/components/client/overview/ClientAlerts';
import { ClientJourneyTrack } from '@/components/client/overview/ClientJourneyTrack';
import { ClientComplianceRunway } from '@/components/client/overview/ClientComplianceRunway';
import { ClientDeliverables } from '@/components/client/overview/ClientDeliverables';
import { ClientEntityCard } from '@/components/client/overview/ClientEntityCard';
import { ClientTeamCard } from '@/components/client/overview/ClientTeamCard';
import { ClientActivityFeed } from '@/components/client/overview/ClientActivityFeed';
import { buildMilestones, type ClientOverviewNeed } from '@/lib/client-overview';

const TODAY = new Date(2026, 8, 12);

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
    windowLabel: '12 Sep – 19 Sep 2026',
    needsCorrection: false,
  },
  needs: [
    {
      stepId: 'pre-1',
      title: 'Client Details',
      action: 'fill',
      href: '/app/client/incorporation?step=pre-1',
      dueDate: '2026-09-19',
    },
  ],
  ballInCourt: { waitingOnClient: 1, waitingOnFirm: 0 },
  documents: { deliverables: [], counts: { requested: 1, submitted: 0, delivered: 0 } },
  compliance: { upcoming: [] },
  milestones: buildMilestones({}),
  activity: [],
  team: [],
  company: buildCompanySnapshot({}),
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
  needs: [],
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
    expect(screen.queryByText(/the next step is yours/)).toBeNull();
    expect(screen.queryByText(/the first step is yours/)).toBeNull();
    expect(screen.getByText('Foreign parent')).toBeInTheDocument();
  });

  it('switches to the post-COI mood', () => {
    draw(<ClientOverviewHero overview={postCoi} />);

    expect(
      screen.getByText('Certificate of Incorporation issued — now in SPICe+ Part A.'),
    ).toBeInTheDocument();
  });

  it('carries the four key numbers in the hero strip, each opening what it counts', () => {
    draw(<ClientOverviewHero overview={postCoi} />);

    expect(screen.getByRole('button', { name: /Awaiting you/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /steps complete/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Documents/ })).toHaveAttribute(
      'href',
      '/app/client/documents',
    );
    expect(screen.getByRole('link', { name: /Next deadline/ })).toHaveAttribute(
      'href',
      '/app/client/compliances/calendar?date=2026-09-20',
    );
    // The first upcoming filing's due date, formatted en-IN ("20 Sep"/"20 Sept").
    expect(screen.getByText(/^20 Sept?$/)).toBeInTheDocument();
  });

  it('offers the status report as a download for this engagement', () => {
    draw(<ClientOverviewHero overview={postCoi} />);
    expect(screen.getByRole('link', { name: /Report/ })).toHaveAttribute(
      'href',
      '/api/client/report?engagementId=e1',
    );
  });

  it('drills from "Awaiting you" into the steps that are the client’s turn', () => {
    draw(<ClientOverviewHero overview={preCoi} />);

    fireEvent.click(screen.getByRole('button', { name: /Awaiting you/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Incorporation steps')).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: /Your turn/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('link', { name: /Client Details/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-1',
    );
    expect(within(dialog).getByRole('link', { name: 'Open Incorporation' })).toBeInTheDocument();
  });

  it('shows an em dash rather than a fake date when no filing is due', () => {
    draw(<ClientOverviewHero overview={preCoi} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

const mixedNeeds: ClientOverviewNeed[] = [
  { stepId: 'pre-1', title: 'Client Details', action: 'fill', href: '/app/client/incorporation?step=pre-1', dueDate: '2026-09-19' },
  { stepId: 'pre-2', title: 'Director KYC', action: 'upload', href: '/app/client/incorporation?step=pre-2' },
  { stepId: 'pre-3', title: 'Board resolution', action: 'sign', href: '/app/client/incorporation?step=pre-3', dueDate: '2026-09-10' },
];

describe('ClientNeeds', () => {
  it('sorts the open steps by what they ask, opening on the first non-empty group', () => {
    draw(<ClientNeeds needs={mixedNeeds} now={TODAY} />);

    expect(screen.getByText('Needs from you')).toBeInTheDocument();
    expect(screen.getByText('3 open')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Upload/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: /Upload Director KYC/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-2',
    );

    fireEvent.click(screen.getByRole('tab', { name: /Fill/ }));
    expect(screen.getByRole('link', { name: /Fill in Client Details/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-1',
    );
    expect(screen.getByText('In 7 days')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Sign/ }));
    expect(screen.getByRole('link', { name: /Review & sign Board resolution/ })).toBeInTheDocument();
    expect(screen.getByText('Overdue 2d')).toBeInTheDocument();
  });

  it('leads with work sent back, showing the reviewer’s note', () => {
    draw(
      <ClientNeeds
        now={TODAY}
        needs={[
          ...mixedNeeds,
          {
            stepId: 'pre-4',
            title: 'Subscriber Details',
            action: 'correct',
            href: '/app/client/incorporation?step=pre-4',
            correctionNote: 'Passport unreadable.',
          },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: /Correct/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Passport unreadable.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fix Subscriber Details/ })).toBeInTheDocument();
  });

  it('states the all-clear when nothing is open', () => {
    draw(<ClientNeeds needs={[]} now={TODAY} />);
    expect(screen.getByText(/Nothing needed from you/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('ClientWhoHolds', () => {
  const milestones = [
    { id: 'pre-16', title: 'Subscriber Details', kind: 'active', phaseId: 'pre-inc-phase-2', colorKey: 'pre', ownedByClient: true },
    { id: 'pre-4', title: 'Name application', kind: 'waiting', phaseId: 'pre-inc-phase-2', colorKey: 'pre', ownedByClient: false },
    { id: 'pre-5', title: 'MCA name approval', kind: 'waiting', phaseId: 'pre-inc-phase-2', colorKey: 'pre', ownedByClient: false },
    { id: 'pre-20', title: 'Later step', kind: 'locked', phaseId: 'pre-inc-phase-2', colorKey: 'pre', ownedByClient: true },
  ] as ClientOverview['milestones'];

  it('splits open steps between the client, the team and MCA, ignoring locked ones', () => {
    draw(<ClientWhoHolds milestones={milestones} />);

    expect(screen.getByRole('img', { name: '1 with you, 1 with the VCFO team, 1 with MCA' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue Subscriber Details/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-16',
    );

    fireEvent.click(screen.getByRole('tab', { name: /MCA/ }));
    expect(screen.getByRole('link', { name: /Open MCA name approval/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-5',
    );
    expect(screen.getByText('MCA reviewing')).toBeInTheDocument();
    expect(screen.queryByText('Later step')).toBeNull();
  });

  it('is calm when nothing is open on any side', () => {
    draw(<ClientWhoHolds milestones={[]} />);
    expect(screen.getByText(/Nothing is open on any side/)).toBeInTheDocument();
  });
});

describe('ClientAlerts', () => {
  it('puts overdue first and widens from 15 to 30 days', () => {
    draw(
      <ClientAlerts
        now={TODAY}
        needs={mixedNeeds}
        upcoming={[
          { id: 'f1', title: 'GSTR-3B', authority: 'GST', group: 'GST', dueDate: '2026-09-20', status: 'upcoming' },
          { id: 'f2', title: 'Form ADT-1', authority: 'MCA', group: 'MCA', dueDate: '2026-10-08', status: 'upcoming' },
          { id: 'f3', title: 'TDS Payment', authority: 'IT', group: 'Income tax', dueDate: '2026-09-07', status: 'filed' },
        ]}
      />,
    );

    expect(screen.getByText('1 overdue')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Overdue 2d')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: /Fix Board resolution/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation?step=pre-3',
    );
    expect(screen.getByRole('link', { name: /View GSTR-3B/ })).toHaveAttribute(
      'href',
      '/app/client/compliances/calendar?date=2026-09-20',
    );
    expect(screen.queryByText('Form ADT-1')).toBeNull();
    expect(screen.queryByText('TDS Payment')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /30 days/ }));
    expect(screen.getByRole('link', { name: /View Form ADT-1/ })).toBeInTheDocument();
  });

  it('says plainly when nothing is due', () => {
    draw(<ClientAlerts now={TODAY} needs={[]} upcoming={[]} />);
    expect(screen.getByText(/No deadlines in the next 15 days/)).toBeInTheDocument();
  });
});

describe('ClientPhaseBars', () => {
  it('renders the four phases with real counts', () => {
    draw(
      <ClientPhaseBars
        progress={preCoi.progress}
        milestones={preCoi.milestones}
        incorporated={false}
      />,
    );

    // Named once. The colour-key legend repeated all four names under bars that
    // already carry them — decoration this pass removed.
    expect(screen.getAllByText('SPICe+ Part A')).toHaveLength(1);
    expect(screen.getAllByText('Registration')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'SPICe+ Part A: 0% complete' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open checklist' })).toBeNull();
  });

  it('frames the path aspirationally pre-COI and factually post-COI', () => {
    const { rerender } = draw(
      <ClientPhaseBars
        progress={preCoi.progress}
        milestones={preCoi.milestones}
        incorporated={false}
      />,
    );
    expect(screen.getByText('Incorporation')).toBeInTheDocument();

    rerender(
      <LazyMotion features={domAnimation}>
        <ClientPhaseBars
          progress={preCoi.progress}
          milestones={preCoi.milestones}
          incorporated
        />
      </LazyMotion>,
    );
    expect(screen.getByText('Where we are')).toBeInTheDocument();
  });

  it('opens a phase’s steps in the same card', () => {
    draw(
      <ClientPhaseBars
        progress={preCoi.progress}
        milestones={preCoi.milestones}
        incorporated={false}
      />,
    );

    expect(screen.getByText('Client Details')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Client Details/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'SPICe+ Part A' }));
    expect(screen.getByRole('link', { name: /Client Details/ })).toHaveAttribute(
      'href',
      '/app/client/incorporation/step/name-application',
    );
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
    expect(screen.getByText('Taxes')).toBeInTheDocument();
    expect(screen.getAllByText('After incorporation').length).toBeGreaterThan(0);
    expect(screen.getByText('GST')).toBeInTheDocument();
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
    expect(
      screen.getByText('Your certificates will appear here as they are issued.'),
    ).toBeInTheDocument();
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

  it('names the forming entity before a certificate exists', () => {
    draw(<ClientEntityCard engagement={preCoi.engagement} identifiers={{}} />);
    expect(screen.getByText('Your entity')).toBeInTheDocument();
    expect(screen.getByText('Acme India Private Limited')).toBeInTheDocument();
    expect(screen.getByText('Forming')).toBeInTheDocument();
    expect(screen.queryByText(/U74999/)).toBeNull();
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

  it('gives each person WhatsApp, email and Teams, and Call only when a number is on file', () => {
    draw(
      <ClientTeamCard
        team={[
          { ...postCoi.team[0]!, phoneE164: '+91 98765 43210' },
          postCoi.team[1]!,
        ]}
        companyName="Acme India Private Limited"
      />,
    );

    expect(screen.getByRole('link', { name: 'Email Pranay Kumar' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:pranay@example\.com\?subject=/),
    );
    expect(screen.getByRole('link', { name: 'Teams Pranay Kumar' })).toHaveAttribute(
      'href',
      'https://teams.microsoft.com/l/chat/0/0?users=pranay%40example.com',
    );
    expect(screen.getByRole('link', { name: 'WhatsApp Pranay Kumar' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/919876543210\?text=Hi%20Pranay/),
    );
    expect(screen.getByRole('link', { name: 'Call Pranay Kumar' })).toHaveAttribute('href', 'tel:+919876543210');
    expect(screen.getByRole('link', { name: 'WhatsApp Sasi Kumar' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=.*Sasi%20Kumar/),
    );
    expect(screen.queryByRole('link', { name: 'Call Sasi Kumar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:info@vcfosuite\.com/),
    );
  });

  it('falls back to the firm address when nobody is assigned yet', () => {
    draw(<ClientTeamCard team={[]} companyName="Acme India Private Limited" />);
    expect(screen.getByRole('link', { name: 'info@vcfosuite.com' })).toBeInTheDocument();
  });
});

describe('ClientActivityFeed', () => {
  it('collapses a run of identical events into one row with a count', () => {
    const repeated = Array.from({ length: 3 }, (_, i) => ({
      id: `r${i}`,
      at: '2026-04-02T10:00:00.000Z',
      label: 'Client asked for a change on Client Details',
    }));
    draw(<ClientActivityFeed activity={[...repeated, { id: 'x', at: '2026-04-01T10:00:00.000Z', label: 'Board resolution finalized' }]} />);

    expect(screen.getAllByText(/Client asked for a change/)).toHaveLength(1);
    expect(screen.getByText('×3')).toBeInTheDocument();
    expect(screen.getByText('Board resolution finalized')).toBeInTheDocument();
  });

  it('only merges neighbours, not every repeat in the list', () => {
    draw(
      <ClientActivityFeed
        activity={[
          { id: 'a', at: '2026-04-03T10:00:00.000Z', label: 'Same' },
          { id: 'b', at: '2026-04-02T10:00:00.000Z', label: 'Different' },
          { id: 'c', at: '2026-04-01T10:00:00.000Z', label: 'Same' },
        ]}
      />,
    );
    expect(screen.getAllByText('Same')).toHaveLength(2);
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it('shows recent scoped audit lines', () => {
    draw(<ClientActivityFeed activity={postCoi.activity} />);
    expect(screen.getByText('Certificate of Incorporation delivered')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Full log' })).toHaveAttribute('href', '/app/client/audit');
  });

  it('explains the empty feed', () => {
    draw(<ClientActivityFeed activity={[]} />);
    expect(screen.getByText('Nothing has been recorded yet.')).toBeInTheDocument();
  });
});
