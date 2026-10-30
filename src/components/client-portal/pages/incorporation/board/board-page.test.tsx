/**
 * Board resolution (NOC), client page (R-52, prototype docs/BOARD-RESOLUTION-NOC.md section 7):
 * the head shows "Passed by"; the track has 6 steps for a foreign parent and 4 for an Indian
 * parent; the tree lights the path `resolveNocVariant()` returns for the four cases; the client
 * never sees the internal file name. Fetches and the portal data hooks are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { checklist } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import { generateBoardResolutionDraft, type BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import { BOARD_RESOLUTION_DOCX_FILENAME } from '@/lib/board-resolution/board-resolution-storage';
import { NOC_TEMPLATES } from '@/lib/noc/templates';
import { resolveNocVariant } from '@/lib/noc/variant';
import type { NocState } from '@/lib/noc/state';
import type { IncData } from '../data';
import { VariantTree, treePath } from '@/components/board-doc';
import { nocMainAction, nocPhase, nocRecords } from './noc';

const portal = { after: false, toast: vi.fn(), go: vi.fn(), openChat: vi.fn(), shell: null };
vi.mock('../../../PortalProvider', () => ({
  usePortal: () => portal,
  usePortalOptional: () => portal,
  usePortalCrumbs: () => undefined,
}));

const app: { engagements: Engagement[]; getStateForEngagement: () => Record<string, unknown> } = { engagements: [], getStateForEngagement: () => ({}) };
vi.mock('@/context/AppContext', () => ({ useApp: () => app }));
vi.mock('@/hooks/use-realtime-board-resolution', () => ({ useRealtimeBoardResolution: () => undefined }));
vi.mock('@/components/board-resolution/BoardResolutionDocPreview', () => ({ BoardResolutionDocPreview: () => <div data-testid="docx-preview" /> }));

let brDoc: BoardResolutionDoc | null = null;
vi.mock('@/lib/projects/engagements-db', () => ({ fetchBoardResolutionInDb: async () => brDoc }));

vi.mock('../ui', async (orig) => ({
  ...(await orig<typeof import('../ui')>()),
  IncFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

let inc: IncData;
vi.mock('../data', async (orig) => ({ ...(await orig<typeof import('../data')>()), useIncData: () => inc }));

import BoardPage from '../BoardPage';

function step(id: string, n: number, kind: string) {
  const item = checklist.find((c) => c.id === id)!;
  return { n, id, title: item.title, item, phaseId: 'p1', phaseNo: 1, owner: 'client', kind, late: false, lateDays: 0, canOpen: true, gate: {} };
}

function setup(e: Partial<Engagement>, s3Kind = 'you') {
  const engagement = {
    id: 'eng-1',
    clientId: 'c1',
    companyName: 'Northwind Technologies India Private Limited',
    companyType: 'foreign',
    ownershipType: 'subsidiary',
    parentEntityName: 'Northwind Inc.',
    internId: 'u1',
    adminId: 'u2',
    createdAt: '2026-09-01',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    ...e,
  } as Engagement;
  app.engagements = [engagement];
  const steps = [step('pre-1', 1, 'done'), step('pre-2', 2, 'done'), step('pre-3', 3, s3Kind), step('pre-4', 4, 'up')];
  inc = {
    model: { phases: [], steps, byId: Object.fromEntries(steps.map((s) => [s.id, s])), spice: { done: 0, total: 0, pct: 0 }, all: { done: 0, total: 0, pct: 0 }, counts: {} },
    engagementId: 'eng-1',
    companyName: engagement.companyName,
    short: 'Northwind',
    today: '2026-10-30',
    incorporated: false,
    extras: null,
    identifiers: {},
    pending: false,
    noEngagement: false,
    requestsFor: () => [],
    refresh: () => undefined,
  } as unknown as IncData;
  brDoc = {
    content: generateBoardResolutionDraft({ engagement, pre1: { parentEntityName: 'Northwind Inc.' } }),
    status: 'finalized',
    storagePath: 'eng-1/board-resolution.docx',
    draftedAt: '2026-09-26T10:00:00Z',
    finalizedAt: '2026-09-28T10:00:00Z',
  };
  return engagement;
}

function nocState(engagement: Engagement, track: NocState['track']): NocState {
  const variant = resolveNocVariant(engagement) ?? 'foreign-parent';
  return {
    variant,
    variantLabel: NOC_TEMPLATES[variant].label,
    resolvedVariant: resolveNocVariant(engagement),
    answers: { ownershipType: engagement.ownershipType ?? null, companyType: engagement.companyType, parentIndianRelationship: engagement.parentIndianRelationship ?? null },
    parentName: engagement.parentEntityName ?? null,
    foreignParent: variant === 'foreign-parent',
    notaryStepsOff: false,
    track,
    accepted: false,
    sentBack: null,
    version: 1,
    // A client response never carries this; the page must not show it even if it did.
    staff: {
      templateFileName: NOC_TEMPLATES[variant].downloadFilename,
      override: null,
      checks: [],
      outOfDate: null,
      vaultDocumentId: null,
      canChangeTemplate: false,
      canReceive: false,
    },
  };
}

function mockNoc(noc: NocState | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/board-resolution/noc') && noc) return new Response(JSON.stringify({ ok: true, noc }), { status: 200 });
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    }),
  );
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BoardPage />
    </QueryClientProvider>,
  );
}

const FOREIGN_TRACK: NocState['track'] = [
  { key: 'drafted', label: 'Drafted', done: true, at: '2026-09-26T10:00:00Z', byName: 'SBC' },
  { key: 'released', label: 'Released', done: true, at: '2026-09-28T10:00:00Z', byName: 'Priya' },
  { key: 'signed', label: 'Signed', done: false },
  { key: 'notarised', label: 'Notarised', done: false },
  { key: 'apostilled', label: 'Apostilled', done: false },
  { key: 'accepted', label: 'Accepted', done: false },
];

beforeEach(() => {
  portal.toast.mockReset();
  portal.go.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('board resolution (NOC) client page', () => {
  it('shows the title, the variant and "Passed by: Board of" the parent', async () => {
    const e = setup({});
    mockNoc(nocState(e, FOREIGN_TRACK));
    renderPage();
    expect(await screen.findByRole('heading', { name: /Board resolution \(NOC\)/ })).toBeInTheDocument();
    expect(screen.getByTestId('noc-passed-by')).toHaveTextContent('Passed by: Board of Northwind Inc. (the parent)');
    await waitFor(() => expect(screen.getByTestId('noc-variant')).toHaveTextContent('NOC — Foreign subsidiary'));
    // C1: Previous and Next step only, no links to steps 2 and 3.
    expect(screen.getByRole('link', { name: /Previous · Previous step/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Next · Next step/ })).toBeInTheDocument();
  });

  it('has 6 track steps for a foreign parent, with Notarised and Apostilled', async () => {
    const e = setup({ companyType: 'foreign' });
    mockNoc(nocState(e, FOREIGN_TRACK));
    renderPage();
    const track = await screen.findByRole('list', { name: 'Progress of the board resolution' });
    await waitFor(() => expect(within(track).getAllByRole('listitem')).toHaveLength(6));
    expect(within(track).getByText('Notarised')).toBeInTheDocument();
    expect(within(track).getByText('Apostilled')).toBeInTheDocument();
    // C4: released and waiting for the scan: the one main button downloads the Word file.
    expect(screen.getByRole('button', { name: 'Download the Word file' })).toBeInTheDocument();
  });

  it('has 4 track steps for an Indian parent, without the notary steps', async () => {
    const e = setup({ companyType: 'domestic', parentIndianRelationship: 'investing' });
    mockNoc(nocState(e, FOREIGN_TRACK.filter((s) => s.key !== 'notarised' && s.key !== 'apostilled')));
    renderPage();
    const track = await screen.findByRole('list', { name: 'Progress of the board resolution' });
    await waitFor(() => expect(within(track).getAllByRole('listitem')).toHaveLength(4));
    expect(within(track).queryByText('Notarised')).toBeNull();
    expect(screen.getByTestId('noc-variant')).toHaveTextContent('NOC — Indian subsidiary (investing)');
  });

  it('builds the same 6 and 4 step tracks from the answers when the NOC route has nothing', async () => {
    setup({ companyType: 'foreign' });
    mockNoc(null);
    const { unmount } = renderPage();
    const track = await screen.findByRole('list', { name: 'Progress of the board resolution' });
    expect(within(track).getAllByRole('listitem')).toHaveLength(6);
    unmount();
    setup({ companyType: 'domestic', parentIndianRelationship: 'name_only' });
    renderPage();
    const track2 = await screen.findByRole('list', { name: 'Progress of the board resolution' });
    expect(within(track2).getAllByRole('listitem')).toHaveLength(4);
  });

  it('tints the filled values on the Draft tab and shows no signed copy yet', async () => {
    const e = setup({});
    mockNoc(nocState(e, FOREIGN_TRACK));
    const { container } = renderPage();
    await screen.findByRole('list', { name: 'Progress of the board resolution' });
    expect(container.querySelector('[data-field="PARENT_ENTITY_NAME"]')).not.toBeNull();
    expect(screen.getByText('No signed copy yet')).toBeInTheDocument();
  });

  it('never shows the internal file name to the client', async () => {
    const e = setup({});
    mockNoc(nocState(e, FOREIGN_TRACK));
    renderPage();
    await screen.findByRole('list', { name: 'Progress of the board resolution' });
    await waitFor(() => expect(screen.getByTestId('noc-variant')).toHaveTextContent('NOC — Foreign subsidiary'));
    const html = document.body.innerHTML;
    for (const v of Object.values(NOC_TEMPLATES)) {
      expect(html).not.toContain(v.downloadFilename);
      expect(html).not.toContain(v.generationTemplateRelative.split('/').pop()!);
    }
    expect(html).not.toContain(BOARD_RESOLUTION_DOCX_FILENAME);
  });
});

describe('the decision tree (C8)', () => {
  const CASES: Array<[string, Partial<Engagement>, string, string | null]> = [
    ['foreign', { ownershipType: 'subsidiary', companyType: 'foreign' }, 'noc-foreign', 'foreign-parent'],
    ['Indian name use', { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'name_only' }, 'noc-name-use', 'indian-name-only'],
    ['Indian investing', { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'investing' }, 'noc-investing', 'indian-investing'],
    ['Indian not chosen', { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: null }, 'no-noc-yet', null],
  ];

  it.each(CASES)('lights the path resolveNocVariant() takes: %s', (_name, answers, result, variant) => {
    expect(resolveNocVariant(answers)).toBe(variant);
    expect(treePath(answers).result).toBe(result);
    const { container, unmount } = render(<VariantTree answers={answers} />);
    const lit = [...container.querySelectorAll('[data-node][data-on="1"]')].map((n) => n.getAttribute('data-node'));
    expect(lit[0]).toBe('own');
    expect(lit).toContain(result);
    // Only one result is lit, and it carries "CHOSEN".
    const results = ['no-noc', 'noc-foreign', 'noc-name-use', 'noc-investing', 'no-noc-yet'];
    expect(lit.filter((id) => results.includes(id!))).toEqual([result]);
    expect(container.querySelector(`[data-node="${result}"] [data-testid="noc-chosen"]`)).not.toBeNull();
    unmount();
  });

  it('Replay dims the path and lights it again in about one second', () => {
    vi.useFakeTimers();
    const answers = { ownershipType: 'subsidiary', companyType: 'foreign' };
    const { container, rerender } = render(<VariantTree answers={answers} replayKey={0} />);
    const lit = () => container.querySelectorAll('[data-node][data-on="1"]').length;
    expect(lit()).toBe(4);
    rerender(<VariantTree answers={answers} replayKey={1} />);
    expect(lit()).toBe(1);
    act(() => vi.advanceTimersByTime(1100));
    expect(lit()).toBe(4);
    vi.useRealTimers();
  });

  it('the page says the foreign choice adds Notarise and Apostille, and Indian adds none', async () => {
    const e = setup({ companyType: 'foreign' });
    mockNoc(nocState(e, FOREIGN_TRACK));
    const { unmount } = renderPage();
    expect(await screen.findByTestId('noc-adds')).toHaveTextContent('This choice adds 2 steps: Notarise · Apostille');
    expect(screen.getByText('Project setup · Ownership type')).toBeInTheDocument();
    unmount();
    setup({ companyType: 'domestic', parentIndianRelationship: 'investing' });
    mockNoc(null);
    renderPage();
    expect(await screen.findByTestId('noc-adds')).toHaveTextContent('This choice adds no steps');
  });
});

describe('the main button (C4)', () => {
  it('downloads when released, uploads when the scan is sent, and is gone when accepted', () => {
    expect(nocMainAction(nocPhase(nocRecords(null, { released: '2026-09-28' })))?.label).toBe('Download the Word file');
    expect(nocMainAction(nocPhase(nocRecords(null, { released: '2026-09-28', signed: '2026-09-30' })))?.label).toBe('Upload signed copy');
    expect(nocMainAction(nocPhase(nocRecords(null, { released: '2026-09-28', signed: '2026-09-30', accepted: '2026-10-08' })))).toBeNull();
  });
});
