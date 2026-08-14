import { BUCKET_LABEL, checklist, type ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { extractItemResponses, getClientResponseFields } from '@/lib/checklist-responses';
import {
  fileNameFromStoragePath,
  isMilestoneStoragePath,
  uploadTimestampFromStoragePath,
} from '@/lib/milestone-document-storage';

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

/** Group flat vault documents by entity → milestone → section. */
export function groupVaultDocuments(
  docs: VaultDocument[],
  engagements: Engagement[],
): VaultEntityGroup[] {
  const docsByEngagement = new Map<string, VaultDocument[]>();
  for (const doc of docs) {
    const list = docsByEngagement.get(doc.engagementId) ?? [];
    list.push(doc);
    docsByEngagement.set(doc.engagementId, list);
  }

  const groups: VaultEntityGroup[] = [];

  for (const engagement of engagements) {
    const engagementDocs = docsByEngagement.get(engagement.id);
    if (!engagementDocs?.length) continue;

    const docsByMilestone = new Map<string, VaultDocument[]>();
    for (const doc of engagementDocs) {
      const list = docsByMilestone.get(doc.milestoneId) ?? [];
      list.push(doc);
      docsByMilestone.set(doc.milestoneId, list);
    }

    const milestones: VaultMilestoneGroup[] = [];
    const orderedItems = checklist
      .filter((item) => docsByMilestone.has(item.id))
      .sort(milestoneOrder);

    for (const item of orderedItems) {
      const milestoneDocs = docsByMilestone.get(item.id)!;
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

      milestones.push({
        milestoneId: item.id,
        milestoneTitle: item.title,
        bucket: BUCKET_LABEL[item.bucket],
        sections,
        docCount: milestoneDocs.length,
      });
    }

    groups.push({
      engagementId: engagement.id,
      companyName: engagement.companyName,
      stage: engagement.stage,
      milestones,
      docCount: engagementDocs.length,
    });
  }

  return groups;
}
