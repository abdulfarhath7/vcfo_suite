import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist/checklist-responses';
import { applyShowWhen, expandRepeatEntry, hiddenEntryAnswersPatch, isRepeatField, type RepeatField } from '@/lib/checklist/checklist-repeat';
import { validatePre16Responses } from '@/lib/checklist/checklist-part-b-validation';

const group = CLIENT_RESPONSE_FIELDS['pre-16'].find(isRepeatField) as RepeatField;
const k = (field: string) => `subscribers.e1.${field}`;
const shown = (responses: Record<string, string>) =>
  applyShowWhen(expandRepeatEntry(group, 'e1'), responses).map((f) => f.id.split('.').pop());

describe('SB-03 subscriber conditional questions', () => {
  it('asks an individual only "Shareholder or nominee shareholder"', () => {
    const ids = shown({ subscribers: 'e1', [k('type')]: 'individual' });
    expect(ids).toContain('holding');
    expect(ids).not.toContain('entityType');
    expect(ids).not.toContain('bodyCorporateOrigin');
  });

  it('asks a body corporate whether it is domestic or foreign, then the matching number', () => {
    const base = { subscribers: 'e1', [k('type')]: 'non-individual', [k('entityType')]: 'body-corporate' };
    expect(shown(base)).toContain('bodyCorporateOrigin');
    expect(shown({ ...base, [k('bodyCorporateOrigin')]: 'domestic' })).toContain('cin');
    const foreign = shown({ ...base, [k('bodyCorporateOrigin')]: 'foreign' });
    expect(foreign).toContain('foreignRegistrationNumber');
    expect(foreign).not.toContain('cin');
  });

  it('labels the foreign company identifier as the UIN under the old field id', () => {
    const field = group.entryFields.find((f) => f.id === 'foreignRegistrationNumber');
    expect(field?.label).toBe('Unique Identification Number (UIN)');
    expect(field?.required).toBe(true);
    expect(JSON.stringify(group.entryFields)).not.toMatch(/FRCN/);
  });

  it('asks an LLP no domestic or foreign question, and neither the CIN nor the UIN', () => {
    const ids = shown({ subscribers: 'e1', [k('type')]: 'non-individual', [k('entityType')]: 'llp' });
    expect(ids).not.toContain('bodyCorporateOrigin');
    expect(ids).not.toContain('cin');
    expect(ids).not.toContain('foreignRegistrationNumber');
    expect(ids).toContain('llpin');
    expect(ids).toContain('authorisedPerson');
    // A stale origin answer from an earlier body corporate choice must not bring the CIN back.
    const stale = shown({ subscribers: 'e1', [k('type')]: 'non-individual', [k('entityType')]: 'llp', [k('bodyCorporateOrigin')]: 'foreign' });
    expect(stale).not.toContain('foreignRegistrationNumber');
  });

  it('hides the chain under a stale answer', () => {
    // Switched back to Individual: the old entity type and origin must not keep the CIN visible.
    const ids = shown({ subscribers: 'e1', [k('type')]: 'individual', [k('entityType')]: 'body-corporate', [k('bodyCorporateOrigin')]: 'domestic' });
    expect(ids).not.toContain('cin');
  });

  it('refuses a domestic CIN that is not 21 characters, and an empty foreign number', () => {
    const base = {
      subscribers: 'e1', [k('type')]: 'non-individual', [k('entityType')]: 'body-corporate',
      [k('name')]: 'Parent Co', [k('address')]: 'Somewhere', [k('authorisedPerson')]: 'A Person',
      [k('shares')]: '100', [k('shareValue')]: '1000',
    };
    const domestic = validatePre16Responses({ ...base, [k('bodyCorporateOrigin')]: 'domestic', [k('cin')]: 'U72900KA2026PTC12' });
    expect(domestic.errors[k('cin')]).toMatch(/21 characters/);
    const foreign = validatePre16Responses({ ...base, [k('bodyCorporateOrigin')]: 'foreign' });
    expect(foreign.errors[k('foreignRegistrationNumber')]).toBeTruthy();
    const ok = validatePre16Responses({ ...base, [k('bodyCorporateOrigin')]: 'foreign', [k('foreignRegistrationNumber')]: '7204218' });
    expect(ok.ok).toBe(true);
  });

  it('clears the answers of hidden questions', () => {
    const patch = hiddenEntryAnswersPatch(
      { subscribers: 'e1', [k('type')]: 'individual', [k('entityType')]: 'body-corporate', [k('bodyCorporateOrigin')]: 'domestic', [k('cin')]: 'U72900KA2026PTC123456' },
      group,
    );
    expect(patch).toEqual({ [k('entityType')]: '', [k('bodyCorporateOrigin')]: '', [k('cin')]: '' });
  });
});
