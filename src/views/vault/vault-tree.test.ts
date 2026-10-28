import { describe, expect, it } from 'vitest';
import type { VaultDocument, VaultEntityGroup } from '@/lib/documents/vault-documents';
import { buildVaultTree, formatUploadDate } from './vault-tree';

function doc(id: string, milestoneId: string, section: string): VaultDocument {
  return {
    id,
    engagementId: 'e1',
    companyName: 'Acme',
    milestoneId,
    milestoneTitle: `Step ${milestoneId}`,
    bucket: 'pre',
    section,
    fieldId: `f-${id}`,
    fieldLabel: `Field ${id}`,
    fileName: `${id}.pdf`,
    storagePath: `path/${id}.pdf`,
    uploadedAt: '2026-10-14T08:00:00.000Z',
  };
}

const a = doc('a', 'm1', 'KYC');
const b = doc('b', 'm1', 'Office');
const c = doc('c', 'm2', 'KYC');
const m1 = { milestoneId: 'm1', milestoneTitle: 'Step m1', bucket: 'pre', docCount: 2, sections: [{ section: 'KYC', docs: [a] }, { section: 'Office', docs: [b] }] };
const m2 = { milestoneId: 'm2', milestoneTitle: 'Step m2', bucket: 'pre', docCount: 1, sections: [{ section: 'KYC', docs: [c] }] };
const entity: VaultEntityGroup = {
  engagementId: 'e1',
  companyName: 'Acme',
  stage: 'Pre-Incorporation',
  milestones: [m1, m2],
  phases: [{ phaseKey: 'pre-inc', phaseLabel: 'Pre-incorporation', milestones: [m1, m2], docCount: 3 }],
  docCount: 3,
};

describe('buildVaultTree', () => {
  it('nests files under phase and step, and tags sections only when a step has several', () => {
    const rows = buildVaultTree(entity, 'step', new Set());
    expect(rows.map((r) => (r.kind === 'folder' ? `F${r.depth}:${r.label}` : `D${r.depth}:${r.doc.id}`))).toEqual([
      'F0:Pre-incorporation',
      'F1:Step m1',
      'D2:a',
      'D2:b',
      'F1:Step m2',
      'D2:c',
    ]);
    const tags = rows.flatMap((r) => (r.kind === 'file' ? [r.tag ?? ''] : []));
    expect(tags).toEqual(['KYC', 'Office', '']);
  });

  it('hides the children of a closed folder', () => {
    const rows = buildVaultTree(entity, 'step', new Set(['phase:pre-inc:m1']));
    expect(rows.filter((r) => r.kind === 'file').map((r) => r.id)).toEqual(['c']);
  });

  it('groups files by section in category view', () => {
    const rows = buildVaultTree(entity, 'cat', new Set());
    expect(rows.map((r) => (r.kind === 'folder' ? `${r.label}:${r.count}` : r.id))).toEqual(['KYC:2', 'a', 'c', 'Office:1', 'b']);
  });
});

describe('formatUploadDate', () => {
  it('shows a dash when the date is unknown', () => {
    expect(formatUploadDate(null)).toBe('—');
  });
});
