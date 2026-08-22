import { BUCKET_LABEL, checklist, getItem, type ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { extractItemResponses, getClientResponseFields } from '@/lib/checklist-responses';
import {
  fileNameFromStoragePath,
  isMilestoneStoragePath,
  uploadTimestampFromStoragePath,
} from '@/lib/milestone-document-storage';

export type VaultDocumentSource = 'milestone' | 'index';

export interface VaultDocument {
  id: string;
  engagementId: string;
  companyName: string;
  milestoneId: string;
  milestoneTitle: string;
  bucket: string;
  section: string;
  fieldId: string;
  fieldLabel: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string | null;
  source?: VaultDocumentSource;
  /** documents-table row id when source is `index`. */
  documentId?: string;
}

/** Indexed files that are not tied to a checklist step. */
export const INDEXED_MILESTONE_ID = '_indexed';

export interface IndexedDocumentRow {
  id: string;
  engagementId: string;
  category: string | null;
  fileName: string;
  objectKey: string;
  stepId: string | null;
  createdAt: string;
  companyName?: string | null;
}

export interface VaultSectionGroup {
  section: string;
  docs: VaultDocument[];
}

export interface VaultMilestoneGroup {
  milestoneId: string;
  milestoneTitle: string;
  bucket: string;
  sections: VaultSectionGroup[];
  docCount: number;
}

export interface VaultEntityGroup {
  engagementId: string;
  companyName: string;
  stage: Engagement['stage'];
  slug?: string;
  milestones: VaultMilestoneGroup[];
  docCount: number;
}

function milestoneOrder(a: ChecklistItem, b: ChecklistItem): number {
  if (a.bucket !== b.bucket) {
    const bucketOrder = ['pre-inc', 'post-inc', 'fema', 'statutory'];
    return bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket);
  }
  return a.order - b.order;
}

function titleCaseCategory(category: string): string {
  const known: Record<string, string> = {
    documents: 'Documents',
    images: 'Images',
    reports: 'Reports',
    deliverables: 'Deliverables',
  };
  if (known[category]) return known[category];
  return category
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function milestoneGroup(
  milestoneId: string,
  milestoneTitle: string,
  bucket: string,
  milestoneDocs: VaultDocument[],
): VaultMilestoneGroup {
  const docsBySection = new Map<string, VaultDocument[]>();
  for (const doc of milestoneDocs) {
    const list = docsBySection.get(doc.section) ?? [];
    list.push(doc);
    docsBySection.set(doc.section, list);
  }

  const sections: VaultSectionGroup[] = [...docsBySection.entries()].map(([section, sectionDocs]) => ({
    section,
    docs: sectionDocs.sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '')),
  }));

  return {
    milestoneId,
    milestoneTitle,
    bucket,
    sections,
    docCount: milestoneDocs.length,
  };
}

function milestonesFromDocs(engagementDocs: VaultDocument[]): VaultMilestoneGroup[] {
  const docsByMilestone = new Map<string, VaultDocument[]>();
  for (const doc of engagementDocs) {
    const list = docsByMilestone.get(doc.milestoneId) ?? [];
    list.push(doc);
    docsByMilestone.set(doc.milestoneId, list);
  }

  const milestones: VaultMilestoneGroup[] = [];
  const used = new Set<string>();
  const orderedItems = checklist
    .filter((item) => docsByMilestone.has(item.id))
    .sort(milestoneOrder);

  for (const item of orderedItems) {
    used.add(item.id);
    milestones.push(
      milestoneGroup(item.id, item.title, BUCKET_LABEL[item.bucket], docsByMilestone.get(item.id)!),
    );
  }

  for (const [milestoneId, milestoneDocs] of docsByMilestone) {
    if (used.has(milestoneId)) continue;
    const sample = milestoneDocs[0];
    milestones.push(
      milestoneGroup(
        milestoneId,
        sample?.milestoneTitle ?? 'Other files',
        sample?.bucket ?? 'Files',
        milestoneDocs,
      ),
    );
  }

  return milestones;
}

/** Collect file uploads from checklist responses across engagements. */
export function collectVaultDocuments(
  engagements: Engagement[],
  getStateForEngagement: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>,
): VaultDocument[] {
  const docs: VaultDocument[] = [];

  for (const engagement of engagements) {
    const state = getStateForEngagement(engagement);

    for (const item of checklist) {
      const slice = state[item.id];
      if (!slice) continue;

      const responses = extractItemResponses(item, slice);
      const fields = getClientResponseFields(item);

      for (const field of fields) {
        if (field.type !== 'file') continue;
        const storagePath = (responses[field.id] ?? '').trim();
        if (!isMilestoneStoragePath(storagePath)) continue;

        const ts = uploadTimestampFromStoragePath(storagePath);

        docs.push({
          id: `${engagement.id}:${item.id}:${field.id}`,
          engagementId: engagement.id,
          companyName: engagement.companyName,
          milestoneId: item.id,
          milestoneTitle: item.title,
          bucket: BUCKET_LABEL[item.bucket],
          section: field.section ?? item.title,
          fieldId: field.id,
          fieldLabel: field.label,
          fileName: fileNameFromStoragePath(storagePath),
          storagePath,
          uploadedAt: ts ? new Date(ts).toISOString() : null,
          source: 'milestone',
        });
      }
    }
  }

  return docs.sort((a, b) => {
    const byCompany = a.companyName.localeCompare(b.companyName);
    if (byCompany !== 0) return byCompany;
    return (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '');
  });
}

/** Map documents-table index rows onto the same checklist taxonomy. */
export function collectIndexedVaultDocuments(
  rows: IndexedDocumentRow[],
  engagements: Engagement[],
): VaultDocument[] {
  const byId = new Map(engagements.map((e) => [e.id, e]));
  const docs: VaultDocument[] = [];

  for (const row of rows) {
    const engagement = byId.get(row.engagementId);
    const item = row.stepId ? getItem(row.stepId) : undefined;
    const category = row.category?.trim() || '';
    const section = item ? (category ? titleCaseCategory(category) : item.title) : titleCaseCategory(category) || 'Other';

    docs.push({
      id: `index:${row.id}`,
      engagementId: row.engagementId,
      companyName: row.companyName?.trim() || engagement?.companyName || 'Unknown company',
      milestoneId: item?.id ?? INDEXED_MILESTONE_ID,
      milestoneTitle: item?.title ?? (category ? titleCaseCategory(category) : 'Other files'),
      bucket: item ? BUCKET_LABEL[item.bucket] : 'Files',
      section,
      fieldId: row.id,
      fieldLabel: row.fileName,
      fileName: row.fileName,
      storagePath: row.objectKey,
      uploadedAt: row.createdAt,
      source: 'index',
      documentId: row.id,
    });
  }

  return docs;
}

/** Deduplicate milestone + index rows that point at the same object. */
export function mergeVaultDocuments(...lists: VaultDocument[][]): VaultDocument[] {
  const seen = new Set<string>();
  const out: VaultDocument[] = [];
  for (const list of lists) {
    for (const doc of list) {
      const key = `${doc.engagementId}:${doc.storagePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(doc);
    }
  }
  return out;
}

/** Drop documents that do not belong to the caller’s accessible engagements. */
export function scopeVaultDocumentsToEngagements(
  docs: VaultDocument[],
  engagements: Engagement[],
): VaultDocument[] {
  const ids = new Set(engagements.map((e) => e.id));
  return docs.filter((doc) => ids.has(doc.engagementId));
}

export function vaultDocMatchesQuery(doc: VaultDocument, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    doc.fileName.toLowerCase().includes(q) ||
    doc.fieldLabel.toLowerCase().includes(q) ||
    doc.section.toLowerCase().includes(q) ||
    doc.milestoneTitle.toLowerCase().includes(q) ||
    doc.companyName.toLowerCase().includes(q)
  );
}

/**
 * Filter entities by client name or document name.
 * A client-name hit keeps every file for that company; otherwise only matching files remain.
 */
export function filterVaultEntityGroups(groups: VaultEntityGroup[], query: string): VaultEntityGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  const out: VaultEntityGroup[] = [];
  for (const entity of groups) {
    const companyHit = entity.companyName.toLowerCase().includes(q);
    if (companyHit) {
      out.push(entity);
      continue;
    }

    const milestones = entity.milestones.flatMap((milestone) => {
      const sections = milestone.sections.flatMap((section) => {
        const docs = section.docs.filter((doc) => vaultDocMatchesQuery(doc, q));
        return docs.length > 0 ? [{ ...section, docs }] : [];
      });
      const docCount = sections.reduce((sum, section) => sum + section.docs.length, 0);
      return sections.length > 0 ? [{ ...milestone, sections, docCount }] : [];
    });
    const docCount = milestones.reduce((sum, milestone) => sum + milestone.docCount, 0);
    if (milestones.length > 0) {
      out.push({ ...entity, milestones, docCount });
    }
  }
  return out;
}

/** Group flat vault documents by entity → milestone → section. */
export function groupVaultDocuments(
  docs: VaultDocument[],
  engagements: Engagement[],
  options?: { includeEmpty?: boolean },
): VaultEntityGroup[] {
  const docsByEngagement = new Map<string, VaultDocument[]>();
  for (const doc of docs) {
    const list = docsByEngagement.get(doc.engagementId) ?? [];
    list.push(doc);
    docsByEngagement.set(doc.engagementId, list);
  }

  const groups: VaultEntityGroup[] = [];
  const seen = new Set<string>();

  for (const engagement of engagements) {
    seen.add(engagement.id);
    const engagementDocs = docsByEngagement.get(engagement.id) ?? [];
    if (!engagementDocs.length && !options?.includeEmpty) continue;

    groups.push({
      engagementId: engagement.id,
      companyName: engagement.companyName,
      stage: engagement.stage,
      slug: engagement.slug,
      milestones: milestonesFromDocs(engagementDocs),
      docCount: engagementDocs.length,
    });
  }

  for (const [engagementId, engagementDocs] of docsByEngagement) {
    if (seen.has(engagementId) || engagementDocs.length === 0) continue;
    const sample = engagementDocs[0];
    groups.push({
      engagementId,
      companyName: sample?.companyName ?? 'Unknown company',
      stage: 'Pre-Incorporation',
      milestones: milestonesFromDocs(engagementDocs),
      docCount: engagementDocs.length,
    });
  }

  return groups;
}
