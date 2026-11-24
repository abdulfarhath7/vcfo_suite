import { describe, expect, it } from 'vitest';
import { changesetHash } from './hash';

const row = { action: 'checklist.setResponse', target: { stepId: 'pre-15', fieldId: 'din' }, newValue: '01234567' };

describe('changesetHash', () => {
  it('does not depend on key order', () => {
    expect(changesetHash([row])).toBe(changesetHash([{ newValue: '01234567', target: { fieldId: 'din', stepId: 'pre-15' }, action: 'checklist.setResponse' }]));
  });

  it('changes with the value, the target, the action or the order', () => {
    const base = changesetHash([row, { ...row, newValue: 'x' }]);
    expect(changesetHash([row, { ...row, newValue: 'y' }])).not.toBe(base);
    expect(changesetHash([{ ...row, newValue: 'x' }, row])).not.toBe(base);
    expect(changesetHash([{ ...row, target: { stepId: 'pre-15', fieldId: 'pan' } }])).not.toBe(changesetHash([row]));
    expect(changesetHash([{ ...row, action: 'other' }])).not.toBe(changesetHash([row]));
  });

  it('gives a draft and the same rows read back from JSONB one hash', () => {
    // JSONB drops a key whose value is undefined; the card must still match at Save.
    const draft = [{ action: 'vault.file', target: { attachmentId: 'a1', folder: undefined, nested: { x: 1, y: undefined } }, newValue: { name: 'f.pdf', note: undefined } }];
    const stored = JSON.parse(JSON.stringify(draft));
    expect(changesetHash(stored)).toBe(changesetHash(draft as never));
    expect(changesetHash([{ ...row, target: { ...row.target, extra: null } }])).not.toBe(changesetHash([row]));
  });
});
