import { describe, expect, it } from 'vitest';
import { DEFAULT_WALK_LIMITS, NOT_A_FILE, TOO_DEEP, TOO_LARGE_FILE, TOO_LARGE_TOTAL, TOO_MANY_FILES, walkFolder } from './folder';
import type { DriveItem } from './graph';

const file = (id: string, name: string, size = 100): DriveItem => ({ id, name, size, file: {} });
const folder = (id: string, name: string): DriveItem => ({ id, name, size: 0, folder: {} });

function tree(map: Record<string, DriveItem[]>) {
  return async (id: string) => map[id] ?? [];
}

describe('walkFolder', () => {
  it('walks sub-folders depth first and keeps the path inside the client folder', async () => {
    const { files, skipped } = await walkFolder(
      tree({
        root: [file('a', 'PAN.pdf'), folder('f1', 'Directors')],
        f1: [file('b', 'Aadhaar.jpg'), folder('f2', 'Ravi')],
        f2: [file('c', 'Passport.pdf')],
      }),
      'root',
    );
    expect(files.map((f) => f.path)).toEqual(['Directors/Aadhaar.jpg', 'Directors/Ravi/Passport.pdf', 'PAN.pdf']);
    expect(skipped).toEqual([]);
  });

  it('leaves out types a drop cannot read, OneNote packages, and system files, with reasons', async () => {
    const { files, skipped } = await walkFolder(
      tree({ root: [file('a', 'plan.dwg'), file('b', 'old.xls'), { id: 'n', name: 'Notes', size: 10, package: { type: 'oneNote' } }, file('d', 'Thumbs.db'), file('e', '.DS_Store'), file('f', 'MOA.docx')] }),
      'root',
    );
    expect(files.map((f) => f.name)).toEqual(['MOA.docx']);
    expect(skipped.map((s) => s.path)).toEqual(['Notes', 'old.xls', 'plan.dwg']);
    expect(skipped.find((s) => s.path === 'Notes')?.reason).toBe(NOT_A_FILE);
    expect(skipped.find((s) => s.path === 'old.xls')?.reason).toContain('save it as .xlsx');
  });

  it('counts files read before and gives the 50 places to new files', async () => {
    const many = Array.from({ length: 55 }, (_, i) => file(`f${i}`, `doc-${String(i).padStart(2, '0')}.pdf`));
    const walked = await walkFolder(tree({ root: many }), 'root', DEFAULT_WALK_LIMITS, (item) => Number(item.id.slice(1)) < 10);
    expect(walked.alreadySeen).toBe(10);
    expect(walked.files).toHaveLength(45);
    expect(walked.files[0]!.name).toBe('doc-10.pdf');
    expect(walked.skipped.filter((s) => s.reason === TOO_MANY_FILES)).toHaveLength(0);
  });

  it('keeps the drop limits: 50 files, 200 MB, 25 MB a file', async () => {
    const many = Array.from({ length: 52 }, (_, i) => file(`f${i}`, `doc-${String(i).padStart(2, '0')}.pdf`));
    const walked = await walkFolder(tree({ root: many }), 'root');
    expect(walked.files).toHaveLength(50);
    expect(walked.skipped.filter((s) => s.reason === TOO_MANY_FILES)).toHaveLength(2);

    const big = await walkFolder(tree({ root: [file('x', 'scan.pdf', 26 * 1024 * 1024)] }), 'root');
    expect(big.skipped[0]?.reason).toBe(TOO_LARGE_FILE);

    const total = await walkFolder(tree({ root: [file('a', 'a.pdf', 60), file('b', 'b.pdf', 60)] }), 'root', { ...DEFAULT_WALK_LIMITS, maxTotalBytes: 100 });
    expect(total.files.map((f) => f.name)).toEqual(['a.pdf']);
    expect(total.skipped[0]?.reason).toBe(TOO_LARGE_TOTAL);
  });

  it('stops at the depth limit', async () => {
    const walked = await walkFolder(tree({ root: [folder('d1', 'One')], d1: [folder('d2', 'Two')], d2: [file('a', 'a.pdf')] }), 'root', { ...DEFAULT_WALK_LIMITS, maxDepth: 1 });
    expect(walked.files).toEqual([]);
    expect(walked.skipped).toEqual([{ itemId: 'd2', path: 'One/Two', size: 0, reason: TOO_DEEP }]);
  });
});
