import { describe, expect, it } from 'vitest';
import { dropContextLine, dropProgressLine, isDropProgressQuestion } from './progress';

const base = {
  files: [],
  groups: [],
  unplaced: [],
  instruction: '',
  progress: { done: 23, total: 50, label: 'Reading…' },
  source: { kind: 'sharepoint', engagementId: 'e1', folderName: 'Bonterra India', pulled: true },
};

describe('isDropProgressQuestion', () => {
  it.each(['show me the progress', 'is it done', 'status?', 'where is the card', 'what happened to the fetch', 'any update on the SharePoint files?', 'is the card ready yet'])(
    'reads "%s" as a progress question',
    (q) => expect(isDropProgressQuestion(q)).toBe(true),
  );

  it.each(['Explain the stamp duty rule for Part A', 'is the GST return for Acme Private Limited complete for October', 'hi', ''])(
    'leaves "%s" to the normal answer',
    (q) => expect(isDropProgressQuestion(q)).toBe(false),
  );
});

describe('dropProgressLine', () => {
  it('gives the live progress of a running SharePoint fetch', () => {
    expect(dropProgressLine({ status: 'running', state: base })).toBe(
      'I am still working on the SharePoint folder Bonterra India: Reading, 23 of 50 files. The card appears in this chat when I finish; nothing is saved until you accept it.',
    );
  });

  it('says a queued drop has not started', () => {
    expect(dropProgressLine({ status: 'queued', state: { ...base, files: [{ path: 'a' }, { path: 'b' }], source: undefined } })).toMatch(/^I have not started on your 2 files yet\./);
  });

  it('points at the card of a finished drop', () => {
    const state = {
      ...base,
      groups: [{ engagementId: 'e1', companyName: 'Bonterra', changesetId: 'c1' }],
      files: Array.from({ length: 50 }, (_, i) => ({ attachmentId: `a${i}`, path: `f${i}.pdf`, size: 1, status: 'placed', engagementId: 'e1' })),
    };
    const text = dropProgressLine({ status: 'waiting_approval', state }, { role: 'intern' });
    expect(text).toContain('It finished. I prepared a card for Bonterra, 50 files. Nothing is saved until you accept.');
    expect(text).toContain('The card is in the chat above.');
  });

  it('says a failed drop saved nothing', () => {
    expect(dropProgressLine({ status: 'failed', state: base })).toMatch(/stopped with an error, so nothing was saved/);
  });

  it('masks identity numbers in file names', () => {
    const state = { ...base, unplaced: [{ attachmentId: 'a', path: 'PAN ABCDE1234F.pdf', reason: 'no client' }] };
    const text = dropProgressLine({ status: 'waiting_reply', state });
    expect(text).toContain('need your answer');
    expect(text).not.toContain('ABCDE1234F');
  });

  it('survives an empty state', () => {
    expect(dropProgressLine({ status: 'running', state: null })).toContain('your files: Waiting for files');
  });
});

describe('dropContextLine', () => {
  it('tells the model what the run is doing and forbids the false claim', () => {
    const text = dropContextLine({ status: 'running', state: base });
    expect(text).toContain('a fetch of the SharePoint folder Bonterra India is running (Reading, 23 of 50 files)');
    expect(text).toContain('Never say nothing was fetched or that you cannot read SharePoint');
  });

  it('names the cards of a settled run', () => {
    const text = dropContextLine({ status: 'waiting_approval', state: { ...base, groups: [{ engagementId: 'e1', companyName: 'Bonterra', changesetId: 'c1' }] } });
    expect(text).toContain('ended as waiting approval, with review cards for Bonterra');
  });
});
