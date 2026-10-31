import { describe, expect, it } from 'vitest';
import type { StatusCode } from '@/data/checklist';
import type { DocPackItem, DocPackSummary } from '@/lib/doc-pack/types';
import { deriveSpiceAttachments, statusFromStep, type SpiceNocFacts } from './derive';

/** Spec T6: the SPICe+ attachment list derives every status from existing records. */

const steps = (map: Record<string, StatusCode>) => (id: string) => map[id];

function copy(docId: string, status: DocPackItem['status'], missing: string[] = []): DocPackItem {
  return {
    key: `${docId}:x`,
    docId,
    part: 'part-b',
    label: docId,
    audience: 'company',
    status,
    source: 'generated',
    missing: missing.map((key) => ({ key, label: key, stepId: 'pre-15' })),
    sourceStepIds: ['pre-5', 'pre-15'],
    generate: { kind: 'incorp', doc: 'inc-9' },
  } as DocPackItem;
}

function pack(items: DocPackItem[]): DocPackSummary {
  return { items, counts: { ready: 0, 'needs-inputs': 0, 'waiting-release': 0 }, total: items.length, skippedDirectors: [] };
}

const noNoc: SpiceNocFacts = { drafted: false, signed: false, accepted: false, vaultDocumentId: null };
const byKey = (list: ReturnType<typeof deriveSpiceAttachments>) => new Map(list.items.map((it) => [it.key, it]));

describe('statusFromStep', () => {
  it('maps the step statuses to the three words', () => {
    expect(statusFromStep('completed')).toBe('done');
    expect(statusFromStep(undefined)).toBe('not-started');
    expect(statusFromStep('not-started')).toBe('not-started');
    expect(statusFromStep('in-progress')).toBe('waiting');
    expect(statusFromStep('awaiting-client')).toBe('waiting');
    expect(statusFromStep('overdue')).toBe('waiting');
  });
});

describe('deriveSpiceAttachments', () => {
  it('lists every attachment as Not started on a new engagement', () => {
    const list = deriveSpiceAttachments({ stepStatus: steps({}), docPack: pack([]), noc: noNoc });
    expect(list.items.map((it) => it.key)).toEqual(['board-resolution', 'parent-proof', 'office-proof', 'director-kyc', 'dir-2', 'inc-9', 'moa', 'aoa']);
    expect(list.items.every((it) => it.status === 'not-started')).toBe(true);
    expect(list.done).toBe(0);
    expect(list.total).toBe(8);
  });

  it('shows an Accepted board resolution as Done with the vault copy', () => {
    const list = deriveSpiceAttachments({
      stepStatus: steps({ 'pre-3': 'completed' }),
      docPack: pack([]),
      noc: { drafted: true, signed: true, accepted: true, vaultDocumentId: 'doc-1' },
    });
    const br = byKey(list).get('board-resolution')!;
    expect(br.status).toBe('done');
    expect(br.detail).toBe('Accepted');
    expect(br.vaultDocumentId).toBe('doc-1');
  });

  it('keeps a signed but not accepted board resolution as Waiting with no link', () => {
    const br = byKey(deriveSpiceAttachments({ stepStatus: steps({}), docPack: pack([]), noc: { ...noNoc, drafted: true, signed: true } })).get(
      'board-resolution',
    )!;
    expect(br.status).toBe('waiting');
    expect(br.vaultDocumentId).toBeNull();
  });

  it('leaves out the board resolution and parent proof when the steps are not applicable', () => {
    const keys = deriveSpiceAttachments({
      stepStatus: steps({ 'pre-2': 'not-applicable', 'pre-3': 'not-applicable' }),
      docPack: pack([]),
      noc: null,
    }).items.map((it) => it.key);
    expect(keys).not.toContain('board-resolution');
    expect(keys).not.toContain('parent-proof');
    expect(keys).toContain('office-proof');
  });

  it('follows the step for office proof and director KYC', () => {
    const map = byKey(
      deriveSpiceAttachments({ stepStatus: steps({ 'pre-14': 'completed', 'pre-15': 'awaiting-client' }), docPack: pack([]), noc: noNoc }),
    );
    expect(map.get('office-proof')!.status).toBe('done');
    expect(map.get('director-kyc')!.status).toBe('waiting');
  });

  it('marks a generated document Done only when every copy is ready', () => {
    const map = byKey(
      deriveSpiceAttachments({
        stepStatus: steps({ 'pre-15': 'in-progress' }),
        docPack: pack([copy('inc-9', 'ready'), copy('inc-9', 'ready'), copy('moa', 'ready'), copy('aoa', 'needs-inputs', ['a', 'b'])]),
        noc: noNoc,
      }),
    );
    expect(map.get('inc-9')!.status).toBe('done');
    expect(map.get('inc-9')!.detail).toBe('2 of 2 copies ready');
    expect(map.get('moa')!.detail).toBe('1 of 1 copy ready');
    expect(map.get('aoa')!.status).toBe('waiting');
    expect(map.get('aoa')!.detail).toBe('Needs 2 inputs');
    expect(map.get('dir-2')!.status).toBe('waiting');
  });

  it('keeps a generated document Not started while no source step has started', () => {
    const aoa = byKey(deriveSpiceAttachments({ stepStatus: steps({}), docPack: pack([copy('aoa', 'needs-inputs', ['a'])]), noc: noNoc })).get('aoa')!;
    expect(aoa.status).toBe('not-started');
  });

  it('marks every attachment Done once SPICe+ is filed, and keeps the accepted copy link', () => {
    const list = deriveSpiceAttachments({
      stepStatus: steps({ 'pre-10': 'completed' }),
      docPack: pack([copy('aoa', 'needs-inputs', ['a'])]),
      noc: { drafted: true, signed: true, accepted: true, vaultDocumentId: 'doc-9' },
    });
    expect(list.done).toBe(list.total);
    expect(byKey(list).get('board-resolution')!.vaultDocumentId).toBe('doc-9');
    expect(byKey(list).get('aoa')!.detail).toBe('Filed with SPICe+');
  });

  it('falls back to the step when the pack could not be read', () => {
    const inc9 = byKey(deriveSpiceAttachments({ stepStatus: steps({ 'pre-7': 'completed' }), docPack: null, noc: noNoc })).get('inc-9')!;
    expect(inc9.status).toBe('done');
  });
});
