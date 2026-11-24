import { describe, expect, it } from 'vitest';
import {
  buildFieldAskEmail,
  fieldAskBell,
  fieldLabelFor,
  fieldsAnsweredBell,
  isFieldReminderDay,
  istDaysSince,
  splitOpenFields,
  stepsDueForReminder,
} from './field-ask-email';
import { clientFieldAskChip, openAsksByStep } from './field-states';

const NOW = new Date('2026-11-24T03:30:00Z'); // 09:00 India time

describe('reminder days', () => {
  it('counts India calendar days', () => {
    // 23:00 India time on 20 Nov is still 20 Nov, so 24 Nov is day 4.
    expect(istDaysSince('2026-11-20T17:30:00Z', NOW)).toBe(4);
    // 00:30 India time on 21 Nov (19:00 UTC on 20 Nov) is day 3.
    expect(istDaysSince('2026-11-20T19:00:00Z', NOW)).toBe(3);
    expect(istDaysSince(null, NOW)).toBeNull();
    expect(istDaysSince('nonsense', NOW)).toBeNull();
  });

  it('reminds on day 3 and day 7 only', () => {
    expect(isFieldReminderDay('2026-11-21T05:00:00Z', NOW)).toBe(true);
    expect(isFieldReminderDay('2026-11-17T05:00:00Z', NOW)).toBe(true);
    expect(isFieldReminderDay('2026-11-22T05:00:00Z', NOW)).toBe(false);
    expect(isFieldReminderDay('2026-11-16T05:00:00Z', NOW)).toBe(false);
    expect(isFieldReminderDay(null, NOW)).toBe(false);
  });

  it('picks each due step once', () => {
    const rows = [
      { engagementDbId: 'e1', itemId: 'pre-1', askedAt: '2026-11-21T05:00:00Z' },
      { engagementDbId: 'e1', itemId: 'pre-1', askedAt: '2026-11-17T05:00:00Z' },
      { engagementDbId: 'e1', itemId: 'pre-4', askedAt: '2026-11-22T05:00:00Z' },
      { engagementDbId: 'e2', itemId: 'pre-1', askedAt: '2026-11-17T05:00:00Z' },
    ];
    expect(stepsDueForReminder(rows, NOW)).toEqual([
      { engagementDbId: 'e1', itemId: 'pre-1' },
      { engagementDbId: 'e2', itemId: 'pre-1' },
    ]);
  });
});

describe('field labels', () => {
  it('reads the label from the step fields and falls back to the id', () => {
    expect(fieldLabelFor('pre-1', 'businessDescription')).toMatch(/^Brief description of the business/);
    expect(fieldLabelFor('pre-1', 'noSuchField')).toBe('noSuchField');
    expect(fieldLabelFor('no-such-step', 'x')).toBe('x');
  });

  it('splits asked and sent back fields', () => {
    const out = splitOpenFields('pre-1', [
      { fieldId: 'a', state: 'asked' },
      { fieldId: 'b', state: 'sent_back' },
      { fieldId: 'c', state: 'answered' },
    ]);
    expect(out).toEqual({ asked: ['a'], correct: ['b'] });
  });
});

describe('buildFieldAskEmail', () => {
  const base = {
    recipientName: 'Asha Rao',
    companyName: 'Acme Pvt Ltd',
    stepTitle: 'Name application',
    asked: ['PAN of director', 'Registered office <address>'],
    correct: ['Share capital'],
    href: 'https://app.example/app/client/incorporation/step/name-application#notified',
  };

  it('lists every field and links to the step', () => {
    const m = buildFieldAskEmail({ ...base, kind: 'ask' });
    expect(m.subject).toBe('Acme Pvt Ltd: SBC needs 3 details for Name application');
    expect(m.text).toContain('Hi Asha,');
    expect(m.text).toContain('Please fill in:\n- PAN of director\n- Registered office <address>');
    expect(m.text).toContain('Please correct:\n- Share capital');
    expect(m.text).toContain(base.href);
    expect(m.html).toContain('Registered office &lt;address&gt;');
    expect(m.html).toContain(base.href);
  });

  it('words a reminder as a reminder and leaves out empty lists', () => {
    const m = buildFieldAskEmail({ ...base, kind: 'remind', correct: [], asked: ['PAN of director'] });
    expect(m.subject).toBe('Reminder: Name application still needs 1 detail');
    expect(m.text).toContain('This is a reminder');
    expect(m.text).not.toContain('Please correct:');
  });

  it('builds the bells', () => {
    expect(fieldAskBell({ kind: 'remind', stepTitle: 'Step', asked: ['a', 'b', 'c'], correct: ['d'] })).toEqual({
      title: 'Reminder: SBC needs 4 details for Step',
      body: 'd, a, b and 1 more',
    });
    expect(fieldsAnsweredBell('Acme', 'Step', 1).title).toBe('Acme answered 1 field on Step');
    expect(fieldsAnsweredBell('Acme', 'Step', 2).title).toBe('Acme answered 2 fields on Step');
  });
});

describe('client view of asks', () => {
  it('shows the client chip', () => {
    expect(clientFieldAskChip({ state: 'asked', askedAt: '2026-11-21T03:30:00Z' }, NOW)).toEqual({ label: 'Asked by SBC · 3d', tone: 'teal' });
    expect(clientFieldAskChip({ state: 'sent_back', askedAt: null }, NOW)).toEqual({ label: 'Please correct', tone: 'bad' });
    expect(clientFieldAskChip({ state: 'approved', askedAt: null }, NOW)).toBeNull();
    expect(clientFieldAskChip(null, NOW)).toBeNull();
  });

  it('groups open asks per step, oldest first', () => {
    const out = openAsksByStep([
      { itemId: 'pre-4', state: 'asked', askedAt: '2026-11-22T00:00:00Z' },
      { itemId: 'pre-1', state: 'asked', askedAt: '2026-11-20T00:00:00Z' },
      { itemId: 'pre-1', state: 'sent_back', askedAt: '2026-11-21T00:00:00Z' },
      { itemId: 'pre-6', state: 'answered', askedAt: '2026-11-19T00:00:00Z' },
    ]);
    expect(out).toEqual([
      { itemId: 'pre-1', asked: 1, correct: 1, oldestAskedAt: '2026-11-20T00:00:00Z' },
      { itemId: 'pre-4', asked: 1, correct: 0, oldestAskedAt: '2026-11-22T00:00:00Z' },
    ]);
  });
});
