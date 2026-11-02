import { describe, expect, it } from 'vitest';
import { batchSummary, finishRows, perFileProgress, progressRows, startRows } from './multi-upload';

describe('perFileProgress', () => {
  it('fills the files in order from the bytes sent', () => {
    // two files of 100 and 300 bytes, body of 400 bytes
    expect(perFileProgress([100, 300], 0, 400)).toEqual([0, 0]);
    expect(perFileProgress([100, 300], 50, 400)).toEqual([50, 0]);
    expect(perFileProgress([100, 300], 250, 400)).toEqual([99, 50]);
    expect(perFileProgress([100, 300], 400, 400)).toEqual([99, 99]);
  });

  it('scales a body that is larger than the files (multipart framing)', () => {
    expect(perFileProgress([100, 100], 110, 220)).toEqual([99, 0]);
  });

  it('is safe with no total, no files and empty files', () => {
    expect(perFileProgress([], 10, 10)).toEqual([]);
    expect(perFileProgress([10], 5, 0)).toEqual([0]);
    expect(perFileProgress([0, 10], 5, 10)).toEqual([0, 50]);
  });
});

describe('upload rows', () => {
  const files = [
    { name: 'a.pdf', size: 100 },
    { name: 'b.png', size: 100 },
    { name: 'c.exe', size: 100 },
  ];

  it('moves from waiting to sending to done, and names each refused file', () => {
    let rows = startRows(files);
    expect(rows.every((r) => r.state === 'waiting')).toBe(true);
    rows = progressRows(rows, 150, 300);
    expect(rows.map((r) => r.state)).toEqual(['sending', 'sending', 'waiting']);
    rows = finishRows(rows, { ok: true, rejected: [{ fileName: 'c.exe', error: 'Upload a PDF, JPG or PNG' }] });
    expect(rows.map((r) => r.state)).toEqual(['done', 'done', 'failed']);
    expect(rows[2]!.error).toBe('Upload a PDF, JPG or PNG');
    expect(rows[0]!.pct).toBe(100);
    expect(batchSummary(rows)).toEqual({ done: 2, failed: 1, total: 3 });
  });

  it('fails every file when the request itself failed', () => {
    const rows = finishRows(startRows(files), { ok: false, error: 'This request is already closed' });
    expect(rows.every((r) => r.state === 'failed' && r.error === 'This request is already closed')).toBe(true);
  });
});
