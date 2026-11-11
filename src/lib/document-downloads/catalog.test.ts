import { describe, expect, it } from 'vitest';

import type { DocPackItem } from '@/lib/doc-pack/types';
import {
  buildDownloadCatalog,
  bundleZipName,
  filesIn,
  pickFiles,
  publicCatalog,
  type CatalogInput,
} from '@/lib/document-downloads/catalog';
import { groupTickState, initialSelection, quickPicks, toggleGroup } from '@/lib/document-downloads/selection';

const ON = new Date('2026-11-11T06:00:00Z');

function item(docId: string, part: 'part-a' | 'part-b', audience: string, extra: Partial<DocPackItem> = {}): DocPackItem {
  return {
    key: `${docId}:${audience}`,
    docId,
    part,
    label: docId.toUpperCase(),
    audience,
    status: 'ready',
    source: 'generated',
    missing: [],
    sourceStepIds: [],
    generate: docId === 'board-resolution' ? { kind: 'board-resolution' } : { kind: 'incorp', doc: docId },
    ...extra,
  } as DocPackItem;
}

function input(overrides: Partial<CatalogInput> = {}): CatalogInput {
  return {
    companyName: 'ember technologies private limited',
    packItems: [
      item('board-resolution', 'part-a', 'company'),
      item('moa', 'part-b', 'company'),
      item('aoa', 'part-b', 'company'),
      item('deposit-declaration', 'part-b', 'company'),
      item('dir-2', 'part-b', 'resident', { directorIndex: 1, directorName: 'Asha Test' }),
      item('inc-9', 'part-b', 'resident', { directorIndex: 1, directorName: 'Asha Test' }),
      item('dir-2', 'part-b', 'non-resident', {
        directorIndex: 2,
        directorName: 'Vik Test',
        status: 'needs-inputs',
        missing: [{ key: 'x', label: 'PAN', stepId: 'pre-15' }],
      }),
    ],
    packFileName: (i) => `${i.docId}.docx`,
    signedBoardResolutionPath: 'br/signed.pdf',
    state: {
      'pre-5': { responses: { mcaApprovalLetterUrl: 'eng/pre-5/approval.pdf' } },
      'pre-14': { responses: { registeredOfficeNocUrl: 'eng/pre-14/noc.pdf', registeredOfficeUtilityBillCopyUrl: 'https://example.test/x' } },
      'reg-4': { responses: { gstCertificateUrl: 'eng/reg-4/gst.pdf' } },
    },
    ...overrides,
  };
}

describe('document download catalog', () => {
  const catalog = buildDownloadCatalog(input());

  it('sorts documents into Part A, Part B (by purpose and director) and after incorporation', () => {
    expect(catalog.root.groups.map((g) => g.folder)).toEqual([
      '01_SPICe-Part-A',
      '02_SPICe-Part-B',
      '03_After-Incorporation',
      '04_Project-Records',
    ]);
    expect(catalog.root.groups[3].files.map((f) => f.fileName)).toEqual([
      expect.stringMatching(/^Answers_Ember-Technologies-Private-Limited_.*\.xlsx$/),
      expect.stringMatching(/^Directors_/),
      expect.stringMatching(/^Subscribers_/),
      expect.stringMatching(/^Audit-Log_/),
    ]);
    const partB = catalog.root.groups[1];
    expect(partB.groups.map((g) => g.folder)).toEqual([
      '01_Constitution',
      '02_Directors',
      '03_Declarations-and-letters',
      '04_Registered-Office-Address',
    ]);
    const directors = partB.groups[1];
    expect(directors.groups.map((g) => g.folder)).toEqual(['Director-1_Asha-Test', 'Director-2_Vik-Test']);
    expect(directors.groups[0].files.map((f) => f.key)).toEqual(['pack:dir-2:resident', 'pack:inc-9:resident']);
  });

  it('lists uploads under their step with GL-08 names, and skips links', () => {
    const office = catalog.root.groups[1].groups[3];
    expect(office.files).toHaveLength(1);
    expect(office.files[0].kind).toBe('uploaded');
    expect(office.files[0].fileName).toMatch(/^Proof-of-office-address[A-Za-z-]*_Ember-Technologies-Private-Limited_\d{2}-\d{2}-\d{4}\.pdf$/i);
  });

  it('keeps not-ready documents visible but never picks them', () => {
    const notReady = filesIn(catalog.root).find((f) => f.key === 'pack:dir-2:non-resident');
    expect(notReady?.ready).toBe(false);
    expect(notReady?.reason).toBe('Needs 1 more answer');
    expect(pickFiles(catalog, ['pack:dir-2:non-resident', 'unknown'])).toEqual([]);
  });

  it('gives picked files their folders', () => {
    const [picked] = pickFiles(catalog, ['pack:inc-9:resident']);
    expect(picked.folders).toEqual(['02_SPICe-Part-B', '02_Directors', 'Director-1_Asha-Test']);
  });

  it('names the ZIP after the smallest group that holds the selection', () => {
    expect(bundleZipName(catalog, ['pack:dir-2:resident', 'pack:inc-9:resident'], ON)).toBe(
      'Asha-Test-Documents_Ember-Technologies-Private-Limited_11-11-2026.zip',
    );
    expect(bundleZipName(catalog, ['pack:moa:company', 'pack:dir-2:resident'], ON)).toBe(
      'SPICe-Part-B_Ember-Technologies-Private-Limited_11-11-2026.zip',
    );
    expect(bundleZipName(catalog, ['pack:moa:company', 'br-signed'], ON)).toBe(
      'Company-Documents_Ember-Technologies-Private-Limited_11-11-2026.zip',
    );
  });

  it('never sends storage paths to the browser', () => {
    expect(JSON.stringify(publicCatalog(catalog))).not.toMatch(/eng\/pre-14|br\/signed|"source"/);
  });
});

describe('download selection', () => {
  const { root } = publicCatalog(buildDownloadCatalog(input()));

  it('offers each part, each director with ready files, uploads and everything', () => {
    expect(quickPicks(root).map((p) => p.id)).toEqual([
      'part-a',
      'part-b',
      'part-b/directors/resident',
      'after',
      'uploaded',
      'all',
    ]);
  });

  it('ticks a group only through its ready files', () => {
    const directors = root.groups[1].groups[1];
    const on = toggleGroup(directors, new Set());
    expect([...on]).toEqual(['pack:dir-2:resident', 'pack:inc-9:resident']);
    expect(groupTickState(directors, on)).toBe('all');
    expect(groupTickState(root.groups[1], on)).toBe('some');
    expect(groupTickState(directors, toggleGroup(directors, on))).toBe('none');
  });

  it('starts from the remembered choice, or everything ready', () => {
    expect([...initialSelection(root, ['pack:moa:company', 'gone'])]).toEqual(['pack:moa:company']);
    expect(initialSelection(root, null).size).toBe(14);
  });
});
