import { describe, expect, it } from 'vitest';
import { findSubAgent } from '@/lib/assist-agents/catalog';
import { cardAgentLevel, cardTasksFor, dataSourceOf, toCardAgentInfo, type CardAgentLiveInputs } from './card-agents';
import { AGENT_SETTINGS_DEFAULTS, cleanAgentSetting, readAgentSettings, routeOpenFor } from './settings';

const off: CardAgentLiveInputs = { packLive: false, browserOpen: false, gstzenOpen: false, killed: false };

describe('card agents', () => {
  it('finds the robots a card carries by step or by obligation', () => {
    expect(cardTasksFor({ stepId: 'reg-4' }).map((t) => t.id)).toEqual(['gst-reg-01']);
    expect(cardTasksFor({ stepId: 'pre-10' }).map((t) => t.id)).toEqual(['spice-b', 'agile-pro-s', 'emoa', 'eaoa', 'inc-9']);
    expect(cardTasksFor({ obligationId: 'gst-gstr-3b' }).map((t) => t.id)).toEqual(['gstr-3b']);
    expect(cardTasksFor({ obligationId: 'mca-msme-1-oct' }).map((t) => t.id)).toEqual(['msme-1']);
    expect(cardTasksFor({ obligationId: 'llp-form-11' })).toEqual([]);
    expect(cardTasksFor({})).toEqual([]);
  });

  it('gives every registration step from reg-1 to reg-24 a robot except POSH and ICDR', () => {
    const missing: string[] = [];
    for (let n = 1; n <= 24; n += 1) if (cardTasksFor({ stepId: `reg-${n}` }).length === 0) missing.push(`reg-${n}`);
    expect(missing).toEqual(['reg-14', 'reg-18', 'reg-19']);
  });

  it('reports the level truthfully', () => {
    const spiceA = findSubAgent('spice-a')!;
    expect(cardAgentLevel(spiceA, off)).toBe('prepare');
    expect(cardAgentLevel(spiceA, { ...off, browserOpen: true })).toBe('practice');
    expect(cardAgentLevel(spiceA, { ...off, browserOpen: true, packLive: true })).toBe('ready');
    expect(cardAgentLevel(spiceA, { ...off, browserOpen: true, packLive: true, killed: true })).toBe('prepare');
    const gst = findSubAgent('gst-reg-01')!;
    expect(cardAgentLevel(gst, { ...off, browserOpen: true, packLive: true })).toBe('prepare');
    const g3b = findSubAgent('gstr-3b')!;
    expect(cardAgentLevel(g3b, off)).toBe('prepare');
    expect(cardAgentLevel(g3b, { ...off, gstzenOpen: true })).toBe('ready');
    expect(cardAgentLevel(findSubAgent('udyam')!, { ...off, browserOpen: true })).toBe('coming');
  });

  it('names the data check source and the robot', () => {
    expect(dataSourceOf(findSubAgent('gst-reg-01')!)).toBe('gst-profile');
    expect(dataSourceOf(findSubAgent('spice-b')!)).toBe('mca-profile');
    expect(dataSourceOf(findSubAgent('gstr-1')!)).toBe('gst-return');
    expect(dataSourceOf(findSubAgent('pt')!)).toBeNull();
    const info = toCardAgentInfo(findSubAgent('gst-reg-01')!, 'prepare');
    expect(info).toMatchObject({ name: 'GST Reg Agent', route: 'browser', levelLabel: 'Prepares data', dataSource: 'gst-profile' });
    expect(toCardAgentInfo(findSubAgent('gstr-3b')!, 'ready').route).toBe('api');
  });
});

describe('agent settings', () => {
  it('starts with every switch off', () => {
    expect(readAgentSettings([])).toEqual(AGENT_SETTINGS_DEFAULTS);
    expect(AGENT_SETTINGS_DEFAULTS.gstzen.live).toBe(false);
    expect(AGENT_SETTINGS_DEFAULTS.browser.live).toBe(false);
  });

  it('reads rows and clamps bad values', () => {
    const s = readAgentSettings([
      { key: 'killSwitch', value: true },
      { key: 'idleMinutes', value: 999 },
      { key: 'gstzen', value: { live: true, pilotUserIds: ['u1', 7] } },
      { key: 'browserHoursCap', value: 'lots' },
    ]);
    expect(s.killSwitch).toBe(true);
    expect(s.idleMinutes).toBe(60);
    expect(s.gstzen).toEqual({ live: true, pilotUserIds: ['u1'] });
    expect(s.browserHoursCap).toBe(100);
  });

  it('rejects values of the wrong type', () => {
    expect(cleanAgentSetting('killSwitch', 'yes')).toBeNull();
    expect(cleanAgentSetting('killSwitch', true)).toBe(true);
    expect(cleanAgentSetting('maxMinutes', 5)).toBe(10);
    expect(cleanAgentSetting('browser', 'on')).toBeNull();
  });

  it('opens a route only when it is live, the kill switch is off and the user is on the pilot list', () => {
    const base = readAgentSettings([{ key: 'gstzen', value: { live: true, pilotUserIds: ['a'] } }]);
    expect(routeOpenFor(base, 'gstzen', 'a')).toBe(true);
    expect(routeOpenFor(base, 'gstzen', 'b')).toBe(false);
    expect(routeOpenFor(base, 'browser', 'a')).toBe(false);
    expect(routeOpenFor({ ...base, killSwitch: true }, 'gstzen', 'a')).toBe(false);
    const all = readAgentSettings([{ key: 'browser', value: { live: true, pilotUserIds: [] } }]);
    expect(routeOpenFor(all, 'browser', 'anyone')).toBe(true);
  });
});
