import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { buildGstProfile } from '@/lib/registrations/gst-profile-build';
import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';

vi.mock('server-only', () => ({}));

const ROWS = [
  { id: 'e-1', slug: 'kestrel-labs', companyName: 'Kestrel Labs Private Limited' },
  { id: 'e-2', slug: 'kestrel-foods', companyName: 'Kestrel Foods Private Limited' },
  { id: 'e-3', slug: 'osprey', companyName: 'Osprey Systems Private Limited' },
];
vi.mock('@/db/repositories/engagements', () => ({
  listEngagements: async () => ROWS,
  getEngagementBySlug: async (_c: unknown, slug: string) => ROWS.find((r) => r.slug === slug) ?? null,
  getEngagementById: async (_c: unknown, id: string) => ROWS.find((r) => r.id === id) ?? null,
}));

const notReady = buildGstProfile({
  engagement: { id: 'e-3', companyName: 'Osprey Systems Private Limited' },
  state: fullState([director('d1', 'yes', 'Asha')]),
  client: {},
  sbc: {},
  requestFiles: [],
});
const fetchGstFromSharepoint = vi.fn(async () => ({ ok: true as const, runId: '00000000-0000-4000-8000-000000000001', message: 'Reading the SharePoint folder Osprey.' }));
const askClientForGst = vi.fn(async () => ({ ok: true as const, listId: 'l-1', href: '/app/lead/requests?list=l-1', items: 4, message: 'I drafted a request list.' }));
vi.mock('@/lib/registrations/gst-sourcing', () => ({
  loadGstReadiness: async () => ({ ok: true, engagementId: 'e-3', slug: 'osprey', result: notReady, zoho: { linked: false } }),
  fetchGstFromSharepoint: (...a: unknown[]) => (fetchGstFromSharepoint as (...x: unknown[]) => unknown)(...a),
  askClientForGst: (...a: unknown[]) => (askClientForGst as (...x: unknown[]) => unknown)(...a),
}));

const { gstWorkAnswer } = await import('./answer');
const lead: AuthContext = { userId: 'u', email: 'l@x.test', name: 'Lead', role: 'intern' };

beforeEach(() => vi.clearAllMocks());

describe('gstWorkAnswer', () => {
  it('answers readiness for the named client with a card and the step target, no model', async () => {
    const out = await gstWorkAnswer(lead, { kind: 'readiness', company: 'osprey' }, { conversationId: 'c-1' });
    expect(out.target).toEqual({ engagementId: 'osprey', stepId: 'reg-4' });
    expect(out.gst).toMatchObject({ engagementId: 'e-3', projectKey: 'osprey', ready: false });
    expect(out.gst?.actions).toContain('fetch_sharepoint');
    expect(out.line).toMatch(/not ready/);
  });

  it('asks which client when the name matches several, or none', async () => {
    expect((await gstWorkAnswer(lead, { kind: 'readiness', company: 'kestrel' }, { conversationId: null })).line).toMatch(/More than one client/);
    expect((await gstWorkAnswer(lead, { kind: 'readiness', company: 'heron' }, { conversationId: null })).line).toMatch(/cannot find/);
    expect((await gstWorkAnswer(lead, { kind: 'readiness', company: null }, { conversationId: null })).line).toMatch(/Which client/);
  });

  it('uses the project on screen, including a registration record', async () => {
    const out = await gstWorkAnswer(lead, { kind: 'readiness', company: null }, { conversationId: null, pagePath: '/app/lead/registrations/osprey~reg-4' });
    expect(out.gst?.projectKey).toBe('osprey');
  });

  it('starts the SharePoint drop into the same chat, so its card follows', async () => {
    const out = await gstWorkAnswer(lead, { kind: 'fetch_sharepoint', company: 'osprey' }, { conversationId: 'c-1' });
    expect(fetchGstFromSharepoint).toHaveBeenCalledWith(lead, { engagementId: 'e-3', conversationId: 'c-1', projectPath: '/projects/osprey' });
    expect(out.runId).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('drafts the client request list and drops the Ask button from the card', async () => {
    const out = await gstWorkAnswer(lead, { kind: 'ask_client', company: 'osprey' }, { conversationId: 'c-1' });
    expect(askClientForGst).toHaveBeenCalledWith(lead, { engagementId: 'e-3' });
    expect(out.gst?.requestHref).toBe('/app/lead/requests?list=l-1');
    expect(out.gst?.actions).not.toContain('ask_client');
  });

  it('never works for a client', async () => {
    const out = await gstWorkAnswer({ ...lead, role: 'client' }, { kind: 'readiness', company: 'osprey' }, { conversationId: null });
    expect(out.gst).toBeUndefined();
  });
});
