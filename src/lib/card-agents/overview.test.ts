import { describe, expect, it } from 'vitest';
import {
  agentCardHref,
  agentFacets,
  agentResultsCsv,
  buildAgentRunItems,
  computeAgentResults,
  dueWithinDays,
  filterAgentRuns,
  gstPeriodMonth,
  gstRunMatches,
  istDayStart,
  monthBounds,
  occurrenceReady,
  parseAgentRunFilters,
  previousMonth,
  summarizeAgentsToday,
  topWithOthers,
  type RawAssistRun,
  type RawEngagement,
  type RawGstRun,
  type RawSession,
} from './overview';
import { manualMinutesFor } from './minutes-saved';

const NOW = new Date('2026-11-26T10:00:00Z'); // 15:30 in India
const ENG: RawEngagement = { dbId: 'db-1', appId: 'e1', slug: 'kestrel', companyName: 'Kestrel Robotics' };

const session = (over: Partial<RawSession> = {}): RawSession => ({
  id: 's1',
  engagement: ENG,
  taskId: 'spice-a',
  runId: null,
  startedByName: 'Divya',
  portalHost: 'www.mca.gov.in',
  portalLoginLabel: 'divya@sbc',
  status: 'running',
  gate: null,
  progressText: 'Page 2 of 9',
  fieldsTotal: 40,
  fieldsDone: 10,
  egressIp: '13.0.0.1',
  viewers: [{ name: 'Divya', ip: '1.2.3.4', firstAt: '2026-11-26T09:50:00Z', lastAt: '2026-11-26T09:58:00Z' }],
  createdAt: '2026-11-26T09:50:00Z',
  readyAt: '2026-11-26T09:51:00Z',
  lastActivityAt: '2026-11-26T09:58:00Z',
  endedAt: null,
  endReason: null,
  ...over,
});

const assist = (over: Partial<RawAssistRun> = {}): RawAssistRun => ({
  id: 'r1',
  engagement: ENG,
  subAgent: 'spice-b',
  status: 'done',
  state: 'DONE',
  fieldsTotal: 100,
  fieldsFilled: 97,
  heals: [
    { field: 'a', tier: 'T1', ok: true },
    { field: 'b', tier: 'T3', ok: false },
  ],
  refusals: [{ kind: 'captcha' }],
  blanks: 2,
  srn: 'AB1234567',
  error: null,
  userName: 'Arjun',
  clientIps: [{ ip: '5.6.7.8', firstAt: '2026-11-26T08:00:00Z', lastAt: '2026-11-26T08:30:00Z' }],
  startedAt: '2026-11-26T08:00:00Z',
  finishedAt: '2026-11-26T08:30:00Z',
  updatedAt: '2026-11-26T08:30:00Z',
  ...over,
});

const gst = (over: Partial<RawGstRun> = {}): RawGstRun => ({
  id: 'g1',
  engagement: ENG,
  gstin: '29ABCDE1234F1Z5',
  form: 'gstr3b',
  period: '102026',
  status: 'consent_needed',
  arn: null,
  error: null,
  checks: [],
  createdByName: 'Divya',
  createdAt: '2026-11-26T09:00:00Z',
  updatedAt: '2026-11-26T09:00:00Z',
  filedAt: null,
  instanceId: 'inst-1',
  ...over,
});

describe('card links', () => {
  it('opens a registration record, a checklist step or a compliance occurrence in the role’s shell', () => {
    expect(agentCardHref({ role: 'intern', engagement: ENG, taskId: 'gst-reg-01' })).toBe('/app/lead/registrations/e1~reg-4');
    expect(agentCardHref({ role: 'super_admin', engagement: ENG, taskId: 'gst-reg-01' })).toBe('/app/admin/registrations/e1~reg-4');
    expect(agentCardHref({ role: 'intern', engagement: ENG, taskId: 'spice-a' })).toMatch(/^\/app\/lead\/engagements\/kestrel\/step\//);
    expect(agentCardHref({ role: 'manager', engagement: ENG, taskId: 'spice-a' })).toMatch(/^\/app\/manager\/projects\/kestrel\/step\//);
    expect(agentCardHref({ role: 'admin', engagement: ENG, taskId: 'gstr-3b', instanceId: 'inst-1' })).toBe('/app/admin/compliances/obligations/gst-gstr-3b/inst-1');
    expect(agentCardHref({ role: 'manager', engagement: ENG, taskId: 'gstr-1' })).toBe('/app/manager/compliances/obligations/gst-gstr-1?company=e1');
    expect(agentCardHref({ role: 'admin', engagement: ENG, taskId: 'nope' })).toBeNull();
  });
});

describe('building the list', () => {
  it('joins a live session to the run it drives and keeps the run once', () => {
    const items = buildAgentRunItems({ role: 'intern', sessions: [session({ runId: 'r1', status: 'done', endedAt: '2026-11-26T08:30:00Z' })], assistRuns: [assist()], gstRuns: [], otps: [], now: NOW });
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item!.source).toBe('session');
    expect(item!.assistRunId).toBe('r1');
    expect(item!.result).toBe('SRN AB1234567');
    expect(item!.isFiling).toBe(true);
    expect(item!.heals).toBe(2);
    expect(item!.healsFailed).toBe(1);
    expect(item!.fieldsDone).toBe(97);
    expect(item!.viewers[0]!.ip).toBe('1.2.3.4');
  });

  it('puts a gate, a pending OTP or a waiting extension run in Your turn', () => {
    const items = buildAgentRunItems({
      role: 'admin',
      sessions: [session({ gate: 'CAPTCHA', status: 'your_turn' })],
      assistRuns: [assist({ id: 'r2', status: 'waiting_user', state: 'WAIT_DSC', srn: null, finishedAt: null })],
      gstRuns: [gst({ status: 'filing' })],
      otps: [
        {
          subjectType: 'gst_return_run',
          subjectId: 'g1',
          purpose: 'evc',
          audience: 'client',
          status: 'pending',
          sentTo: 'mobile ending 4821',
          requestedAt: '2026-11-26T09:30:00Z',
          requestedByName: 'Divya',
          answeredAt: null,
          answeredByName: null,
        },
      ],
      now: NOW,
    });
    expect(items.every((i) => i.bucket === 'your_turn')).toBe(true);
    expect(items.find((i) => i.source === 'session')!.stateLabel).toBe('Your turn: captcha');
    expect(items.find((i) => i.source === 'extension')!.stateLabel).toBe('Your turn: sign with DSC');
    expect(items.find((i) => i.source === 'gst')!.stateLabel).toBe('Client EVC OTP sent, waiting');
    expect(items.find((i) => i.source === 'gst')!.route).toBe('api');
  });

  it('words the GST states and links the return to its occurrence', () => {
    const [draft] = buildAgentRunItems({ role: 'admin', sessions: [], assistRuns: [], gstRuns: [gst({ status: 'draft' })], otps: [], now: NOW });
    expect(draft!.bucket).toBe('waiting');
    expect(draft!.action).toBe('Fix');
    expect(draft!.href).toBe('/app/admin/compliances/obligations/gst-gstr-3b/inst-1');
    const [filed] = buildAgentRunItems({ role: 'admin', sessions: [], assistRuns: [], gstRuns: [gst({ status: 'filed', arn: 'AA2910260001', filedAt: '2026-11-26T09:20:00Z' })], otps: [], now: NOW });
    expect(filed!.bucket).toBe('done');
    expect(filed!.result).toBe('ARN AA2910260001');
    expect(filed!.minutes).toBe(20);
  });

  it('sorts open runs first (your turn, running, waiting), then the newest', () => {
    const items = buildAgentRunItems({
      role: 'admin',
      sessions: [session({ id: 'run1' }), session({ id: 'turn', gate: 'LOGIN', status: 'your_turn' })],
      assistRuns: [assist({ id: 'old', startedAt: '2026-11-20T08:00:00Z' }), assist({ id: 'new' })],
      gstRuns: [gst({ status: 'draft' })],
      otps: [],
      now: NOW,
    });
    expect(items.map((i) => i.id)).toEqual(['session:turn', 'session:run1', 'gst:g1', 'extension:new', 'extension:old']);
    expect(items[1]!.action).toBe('Watch');
  });
});

describe('filters', () => {
  const items = buildAgentRunItems({
    role: 'admin',
    sessions: [session()],
    assistRuns: [assist({ id: 'old', startedAt: '2026-10-01T08:00:00Z', finishedAt: '2026-10-01T08:30:00Z' }), assist()],
    gstRuns: [],
    otps: [],
    now: NOW,
  });

  it('reads the query string with safe defaults', () => {
    expect(parseAgentRunFilters(new URLSearchParams(''))).toEqual({ state: 'all', period: 'week', agent: null, search: '' });
    expect(parseAgentRunFilters(new URLSearchParams('state=bogus&period=year&agent=nope'))).toEqual({ state: 'all', period: 'week', agent: null, search: '' });
    expect(parseAgentRunFilters(new URLSearchParams('state=your_turn&period=today&agent=gstr-3b&search=%20kes%20'))).toEqual({ state: 'your_turn', period: 'today', agent: 'gstr-3b', search: 'kes' });
  });

  it('keeps open runs whatever the period and drops old closed ones', () => {
    const week = filterAgentRuns(items, { state: 'all', period: 'week', agent: null, search: '' }, NOW);
    expect(week.map((i) => i.id)).toEqual(['session:s1', 'extension:r1']);
    expect(filterAgentRuns(items, { state: 'all', period: 'all', agent: null, search: '' }, NOW)).toHaveLength(3);
  });

  it('filters by state, agent and search', () => {
    const base = { period: 'all' as const, agent: null, search: '' };
    expect(filterAgentRuns(items, { ...base, state: 'open' }, NOW).map((i) => i.id)).toEqual(['session:s1']);
    expect(filterAgentRuns(items, { ...base, state: 'done' }, NOW)).toHaveLength(2);
    expect(filterAgentRuns(items, { ...base, state: 'all', agent: 'spice-a' }, NOW)).toHaveLength(1);
    expect(filterAgentRuns(items, { ...base, state: 'all', search: 'ab1234' }, NOW)).toHaveLength(2);
    expect(filterAgentRuns(items, { ...base, state: 'all', search: 'nobody' }, NOW)).toHaveLength(0);
    expect(agentFacets(items)).toEqual([
      { taskId: 'spice-b', name: 'SPICe+ Agent', count: 2 },
      { taskId: 'spice-a', name: 'Name Reservation Agent', count: 1 },
    ]);
  });
});

describe('Agents today', () => {
  it('counts your turn, running, filed today and the occurrences due in seven days with the ready ones', () => {
    const items = buildAgentRunItems({
      role: 'intern',
      sessions: [session(), session({ id: 's2', gate: 'OTP', status: 'your_turn' })],
      assistRuns: [assist(), assist({ id: 'y', finishedAt: '2026-11-25T08:00:00Z' })],
      gstRuns: [],
      otps: [],
      now: NOW,
    });
    const occ = (id: string, dueDate: string, stage: string | null = null) => ({
      id,
      engagementDbId: 'db-1',
      obligationId: 'gst-gstr-3b',
      dueDate,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'upcoming',
      filedOn: null,
      stage,
    });
    const s = summarizeAgentsToday(
      items,
      [occ('a', '2026-11-26', 'ready'), occ('b', '2026-12-03'), occ('c', '2026-12-04'), occ('d', '2026-11-25')],
      [{ engagementDbId: 'db-1', form: 'gstr3b', period: '102026', status: 'saved' }],
      NOW,
    );
    expect(s.yourTurn).toBe(1);
    expect(s.running).toBe(1);
    expect(s.filedToday).toBe(1);
    expect(s.dueIn7).toBe(2);
    expect(s.dueReady).toBe(2);
    expect(s.yourTurnRuns[0]!.id).toBe('session:s2');
  });

  it('matches a GST return to its month and reads readiness', () => {
    expect(gstPeriodMonth('102026')).toBe('2026-10');
    expect(gstPeriodMonth('132026')).toBeNull();
    const occ = { engagementDbId: 'db-1', obligationId: 'gst-gstr-3b', periodStart: '2026-10-01', periodEnd: '2026-10-31' };
    expect(gstRunMatches(occ, { engagementDbId: 'db-1', form: 'gstr3b', period: '102026' })).toBe(true);
    expect(gstRunMatches(occ, { engagementDbId: 'db-1', form: 'gstr1', period: '102026' })).toBe(false);
    expect(gstRunMatches(occ, { engagementDbId: 'db-2', form: 'gstr3b', period: '102026' })).toBe(false);
    const full = { ...occ, id: 'x', dueDate: '2026-11-20', status: 'upcoming', filedOn: null, stage: null };
    expect(occurrenceReady(full, [{ engagementDbId: 'db-1', form: 'gstr3b', period: '102026', status: 'draft' }])).toBe(false);
    expect(occurrenceReady({ ...full, stage: 'review' }, [])).toBe(true);
    expect(dueWithinDays({ dueDate: '2026-12-03', status: 'upcoming', filedOn: null }, '2026-11-26')).toBe(true);
    expect(dueWithinDays({ dueDate: '2026-12-03', status: 'filed', filedOn: null }, '2026-11-26')).toBe(false);
  });

  it('starts the day at midnight in India', () => {
    expect(istDayStart(new Date('2026-11-25T20:00:00Z')).toISOString()).toBe('2026-11-25T18:30:00.000Z');
  });
});

describe('Agent results', () => {
  const items = buildAgentRunItems({
    role: 'admin',
    sessions: [session({ id: 'b1', status: 'done', endedAt: '2026-11-26T10:00:00Z', createdAt: '2026-11-26T09:00:00Z' })],
    assistRuns: [
      assist({ id: 'a1' }),
      assist({ id: 'a2', subAgent: 'spice-a', startedAt: '2026-11-10T08:00:00Z', finishedAt: '2026-11-10T08:10:00Z', fieldsTotal: 20, fieldsFilled: 20, heals: [], srn: 'X1' }),
      assist({ id: 'oct', startedAt: '2026-10-10T08:00:00Z', finishedAt: '2026-10-10T08:10:00Z' }),
      assist({ id: 'nofile', srn: null, startedAt: '2026-11-12T08:00:00Z', finishedAt: '2026-11-12T09:00:00Z' }),
    ],
    gstRuns: [gst({ status: 'filed', arn: 'AA29', createdAt: '2026-11-20T09:00:00Z', filedAt: '2026-11-20T09:05:00Z' })],
    otps: [],
    now: NOW,
  });
  const r = computeAgentResults({
    month: '2026-11',
    items,
    patches: [
      { recipeId: 'spice-b', status: 'approved', createdAt: '2026-11-02T00:00:00Z', reviewedAt: '2026-11-03T00:00:00Z' },
      { recipeId: 'spice-b', status: 'proposed', createdAt: '2026-11-05T00:00:00Z', reviewedAt: null },
      { recipeId: 'spice-a', status: 'proposed', createdAt: '2026-10-05T00:00:00Z', reviewedAt: null },
    ],
    browserHoursCap: 100,
  });

  it('counts filings by agent with the change against last month', () => {
    expect(r.filings).toBe(3);
    expect(r.filingsPrev).toBe(1);
    expect(r.byAgent).toEqual([
      { taskId: 'gstr-3b', name: 'GSTR-3B Agent', count: 1 },
      { taskId: 'spice-a', name: 'Name Reservation Agent', count: 1 },
      { taskId: 'spice-b', name: 'SPICe+ Agent', count: 1 },
    ]);
    expect(r.apiFilings).toBe(1);
  });

  it('estimates minutes saved from the manual minutes table, never below zero', () => {
    const expected = Math.max(0, manualMinutesFor('spice-b') - 30) + Math.max(0, manualMinutesFor('spice-a') - 10) + Math.max(0, manualMinutesFor('gstr-3b') - 5);
    expect(r.minutesSaved).toBe(expected);
    expect(r.hoursSaved).toBe(Math.round((expected / 60) * 10) / 10);
    expect(r.minutesAfter).toBe(10);
    expect(r.minutesBefore).toBe(Math.round((manualMinutesFor('spice-b') + manualMinutesFor('spice-a') + manualMinutesFor('gstr-3b')) / 3));
  });

  it('works out fields auto-filled, heals, breaks and browser hours', () => {
    // a1 97/100, a2 20/20, nofile 97/100 and the session 10/40 started in November.
    expect(r.fieldsFilled).toBe(97 + 20 + 97 + 10);
    expect(r.fieldsTotal).toBe(260);
    expect(r.autoFilledPct).toBe(Math.round((224 / 260) * 100));
    expect(r.heals).toBe(4);
    expect(r.healsFailed).toBe(2);
    expect(r.breaks).toBe(2);
    expect(r.breakRecipes).toBe(1);
    expect(r.breaksFixed).toBe(1);
    expect(r.browserHours).toBe(1);
    expect(r.browserSessions).toBe(1);
  });

  it('exports one CSV row per filing with the estimate marked', () => {
    const csv = agentResultsCsv(r).split('\n');
    expect(csv[0]).toContain('Manual minutes (estimate)');
    expect(csv).toHaveLength(4);
    // Oldest filing first: 10 Nov (SPICe+ Part A), 20 Nov (GSTR-3B by API), 26 Nov (Part B).
    expect(csv[2]).toContain('"API"');
    expect(csv[3]).toContain('"Browser"');
  });

  it('handles months and the Others bar', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(monthBounds('2026-11').start.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(topWithOthers([1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `a${n}`, count: 8 - n })), 5)).toEqual([
      { name: 'a1', count: 7 },
      { name: 'a2', count: 6 },
      { name: 'a3', count: 5 },
      { name: 'a4', count: 4 },
      { name: 'a5', count: 3 },
      { name: 'Others', count: 3 },
    ]);
  });
});
