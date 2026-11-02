import { describe, expect, it } from 'vitest';
import type { DocNode } from '@/lib/client-portal/documents';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { buildTree, counts, docState, docStateLabel, earlierVersions, fileKindOf, matches, previewModeOf } from './model';

const node = (p: Partial<DocNode> & Pick<DocNode, 'id' | 'label' | 'status'>): DocNode => ({
  fileName: `${p.label}.pdf`,
  replaced: p.status === 'Replaced',
  from: 'SBC',
  fromSbc: true,
  categoryId: 'c3',
  source: 'index',
  ...p,
});

const model = {
  phases: [
    { no: 1, id: 'p1', name: 'Name application', section: 'SPICe+ Part A', steps: [{ id: 'pre-2', n: 2, title: 'Name approval' }] },
    { no: 2, id: 'p2', name: 'Incorporation', section: 'SPICe+ Part B', steps: [{ id: 'pre-12', n: 12, title: 'Certificate of Incorporation' }, { id: 'pre-6', n: 6, title: 'Director KYC' }] },
  ],
  byId: { 'pre-2': { id: 'pre-2' }, 'pre-12': { id: 'pre-12' }, 'pre-6': { id: 'pre-6' } },
} as unknown as PortalIncorporationModel;

describe('documents model', () => {
  it('maps real statuses to the prototype states', () => {
    expect(docState(node({ id: 'a', label: 'COI', status: 'Final' }))).toBe('ok');
    expect(docStateLabel(node({ id: 'a', label: 'COI', status: 'Final' }))).toBe('Final');
    expect(docState(node({ id: 'b', label: 'PAN', status: 'Approved' }))).toBe('ok');
    expect(docState(node({ id: 'c', label: 'Lease', status: 'In review' }))).toBe('review');
    expect(docState(node({ id: 'd', label: 'DIR-2', status: 'Missing', fileName: '—' }))).toBe('req');
    expect(docState(node({ id: 'e', label: 'DIR-2', status: 'Missing', fileName: '—', overdue: true }))).toBe('over');
    expect(docState(node({ id: 'f', label: 'Lease v1', status: 'Replaced' }))).toBe('rep');
  });

  it('groups documents by phase and step in checklist order, unknown steps under Other', () => {
    const tree = buildTree(
      [
        node({ id: '1', label: 'COI', status: 'Final', stepId: 'pre-12' }),
        node({ id: '2', label: 'RUN letter', status: 'Final', stepId: 'pre-2' }),
        node({ id: '3', label: 'Shared file', status: 'Final' }),
        node({ id: '4', label: 'PAN card', status: 'Replaced', stepId: 'pre-6' }),
        node({ id: '5', label: 'PAN card', status: 'Approved', stepId: 'pre-6' }),
      ],
      model,
    );
    expect(tree.map((p) => p.id)).toEqual(['p1', 'p2', 'other']);
    expect(tree[1]!.steps.map((s) => s.no)).toEqual([12, 6]);
    // current file before its replaced version
    expect(tree[1]!.steps[1]!.docs.map((d) => d.id)).toEqual(['5', '4']);
    expect(tree[2]!.steps[0]!.docs[0]!.id).toBe('3');
  });

  it('counts live documents and what is still needed', () => {
    const c = counts([
      node({ id: '1', label: 'COI', status: 'Final' }),
      node({ id: '2', label: 'Old', status: 'Replaced' }),
      node({ id: '3', label: 'DIR-2', status: 'Missing', fileName: '—' }),
      node({ id: '4', label: 'Lease', status: 'In review' }),
    ]);
    expect(c).toEqual({ total: 3, received: 2, need: 1, ok: 1, review: 1 });
  });

  it('filters by state, replaced toggle and text', () => {
    const rep = node({ id: '2', label: 'Old lease', status: 'Replaced' });
    const need = node({ id: '3', label: 'DIR-2', status: 'Missing', fileName: '—', overdue: true });
    expect(matches(rep, { phase: 'all', stat: 'all', rep: false, q: '' })).toBe(false);
    expect(matches(rep, { phase: 'all', stat: 'all', rep: true, q: '' })).toBe(true);
    expect(matches(need, { phase: 'all', stat: 'need', rep: false, q: '' })).toBe(true);
    expect(matches(need, { phase: 'all', stat: 'ok', rep: false, q: '' })).toBe(false);
    expect(matches(need, { phase: 'all', stat: 'all', rep: false, q: 'dir' })).toBe(true);
    expect(matches(need, { phase: 'all', stat: 'all', rep: false, q: 'pan' })).toBe(false);
  });

  it('finds earlier versions by request or by step + label', () => {
    const cur = node({ id: '1', label: 'Lease', status: 'Approved', stepId: 'pre-6' });
    const all = [cur, node({ id: '2', label: 'Lease', status: 'Replaced', stepId: 'pre-6' }), node({ id: '3', label: 'PAN', status: 'Replaced', stepId: 'pre-6' })];
    expect(earlierVersions(cur, all).map((d) => d.id)).toEqual(['2']);
  });

  it('knows file kinds and preview modes', () => {
    expect(fileKindOf('a.pdf')).toBe('PDF');
    expect(fileKindOf('a.docx')).toBe('DOCX');
    expect(fileKindOf('a.JPG')).toBe('JPG');
    expect(fileKindOf('x', 'image/png')).toBe('JPG');
    expect(previewModeOf('a.pdf')).toBe('pdf');
    expect(previewModeOf('a.png')).toBe('image');
    expect(previewModeOf('a.docx')).toBe('none');
  });
});
