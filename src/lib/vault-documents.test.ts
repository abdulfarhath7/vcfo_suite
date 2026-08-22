import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import {
  internMayAccessEngagementDocuments,
  internVisibleDocuments,
} from '@/lib/document-access';
import {
  collectIndexedVaultDocuments,
  filterVaultEntityGroups,
  groupVaultDocuments,
  mergeVaultDocuments,
  scopeVaultDocumentsToEngagements,
  type VaultDocument,
} from '@/lib/vault-documents';

const internA = 'intern-a';
const internB = 'intern-b';

const assigned: Engagement = {
  id: 'eng-a',
  clientId: 'c-a',
  companyName: 'Acme Pvt Ltd',
  companyType: 'domestic',
  internId: internA,
  adminId: 'admin',
  createdAt: '2026-08-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

const otherIntern: Engagement = {
  id: 'eng-b',
  clientId: 'c-b',
  companyName: 'Beta Exports',
  companyType: 'domestic',
  internId: internB,
  adminId: 'admin',
  createdAt: '2026-08-01T00:00:00.000Z',
  stage: 'Post-Incorporation',
  health: 'on-track',
};

const memberOnly: Engagement = {
  id: 'eng-m',
  clientId: 'c-m',
  companyName: 'Member Co',
  companyType: 'domestic',
  internId: internB,
  adminId: 'admin',
  createdAt: '2026-08-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

function doc(
  engagement: Engagement,
  fileName: string,
  extra?: Partial<VaultDocument>,
): VaultDocument {
  return {
    id: `${engagement.id}:${fileName}`,
    engagementId: engagement.id,
    companyName: engagement.companyName,
    milestoneId: extra?.milestoneId ?? 'pre-1',
    milestoneTitle: extra?.milestoneTitle ?? 'Client details',
    bucket: extra?.bucket ?? 'Pre-Incorporation',
    section: extra?.section ?? 'KYC',
    fieldId: extra?.fieldId ?? 'pan',
    fieldLabel: extra?.fieldLabel ?? 'PAN card',
    fileName,
    storagePath: extra?.storagePath ?? `${engagement.id}/pan/1-${fileName}`,
    uploadedAt: extra?.uploadedAt ?? '2026-08-20T00:00:00.000Z',
    source: extra?.source ?? 'milestone',
    documentId: extra?.documentId,
  };
}

describe('intern document access (Path A)', () => {
  it('lets a lead read assigned-client docs and not another intern’s client', () => {
    expect(internMayAccessEngagementDocuments(internA, assigned)).toBe(true);
    expect(internMayAccessEngagementDocuments(internA, otherIntern)).toBe(false);
    expect(internMayAccessEngagementDocuments(internA, memberOnly, [memberOnly.id])).toBe(true);
    expect(internMayAccessEngagementDocuments(undefined, assigned)).toBe(false);
  });

  it('strips another intern’s client documents from a mixed list', () => {
    const mixed = [doc(assigned, 'acme-pan.pdf'), doc(otherIntern, 'beta-gst.pdf')];
    const visible = internVisibleDocuments(internA, mixed, [assigned, otherIntern]);
    expect(visible.map((row) => row.fileName)).toEqual(['acme-pan.pdf']);
  });
});

describe('vault grouping', () => {
  it('groups by company then checklist step and keeps empty clients', () => {
    const groups = groupVaultDocuments([doc(assigned, 'acme-pan.pdf')], [assigned, otherIntern], {
      includeEmpty: true,
    });
    expect(groups.map((g) => g.companyName)).toEqual(['Acme Pvt Ltd', 'Beta Exports']);
    expect(groups[0]?.docCount).toBe(1);
    expect(groups[0]?.milestones[0]?.milestoneId).toBe('pre-1');
    expect(groups[1]?.docCount).toBe(0);
    expect(groups[1]?.milestones).toEqual([]);
  });

  it('does not surface another intern’s company when that engagement is not in scope', () => {
    const mixed = [doc(assigned, 'acme-pan.pdf'), doc(otherIntern, 'beta-gst.pdf')];
    const scoped = scopeVaultDocumentsToEngagements(mixed, [assigned]);
    const groups = groupVaultDocuments(scoped, [assigned], { includeEmpty: true });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.companyName).toBe('Acme Pvt Ltd');
    expect(groups[0]?.docCount).toBe(1);
  });

  it('filters by client name without hiding that client’s files', () => {
    const groups = groupVaultDocuments(
      [doc(assigned, 'acme-pan.pdf'), doc(otherIntern, 'beta-gst.pdf')],
      [assigned, otherIntern],
    );
    const filtered = filterVaultEntityGroups(groups, 'acme');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.docCount).toBe(1);
    expect(filtered[0]?.milestones[0]?.sections[0]?.docs[0]?.fileName).toBe('acme-pan.pdf');
  });

  it('filters by document name across clients', () => {
    const groups = groupVaultDocuments(
      [doc(assigned, 'director-id.pdf'), doc(otherIntern, 'gst-certificate.pdf')],
      [assigned, otherIntern],
    );
    const filtered = filterVaultEntityGroups(groups, 'gst-certificate');
    expect(filtered.map((g) => g.companyName)).toEqual(['Beta Exports']);
    expect(filtered[0]?.docCount).toBe(1);
  });

  it('maps indexed rows onto the checklist step when stepId is set', () => {
    const indexed = collectIndexedVaultDocuments(
      [
        {
          id: 'doc-1',
          engagementId: assigned.id,
          category: 'documents',
          fileName: 'spice-ack.pdf',
          objectKey: `${assigned.id}/spice/1-spice-ack.pdf`,
          stepId: 'pre-4',
          createdAt: '2026-08-21T00:00:00.000Z',
        },
      ],
      [assigned],
    );
    expect(indexed[0]?.milestoneId).toBe('pre-4');
    expect(indexed[0]?.source).toBe('index');
    expect(indexed[0]?.documentId).toBe('doc-1');
  });

  it('dedupes index rows that share a milestone storage path', () => {
    const path = `${assigned.id}/pan/1-acme-pan.pdf`;
    const merged = mergeVaultDocuments(
      [doc(assigned, 'acme-pan.pdf', { storagePath: path })],
      [
        doc(assigned, 'acme-pan.pdf', {
          id: 'index:dup',
          storagePath: path,
          source: 'index',
          documentId: 'dup',
        }),
      ],
    );
    expect(merged).toHaveLength(1);
  });
});
