import { sep } from '@/lib/date-format';
import type { VaultDocument, VaultEntityGroup } from '@/lib/documents/vault-documents';

/*
 * Tree model for the staff Vault explorer (K-39). Pure functions, so the tree can be tested
 * without rendering the page.
 */

export type VaultTreeView = 'step' | 'cat';

/** One row of the tree: a folder or a file, with its depth for the indent guides. */
export type VaultTreeRow =
  | { kind: 'folder'; id: string; label: string; depth: number; count: number }
  | { kind: 'file'; id: string; doc: VaultDocument; depth: number; tag?: string; sub?: string };

/** Plain date for a file ("14 Oct 2026"), or a dash when the upload time is unknown. */
export function formatUploadDate(iso: string | null): string {
  if (!iso) return '—';
  return sep(
    new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  );
}

/**
 * Flatten one client's documents into tree rows. Folders whose id is in `closed` hide their
 * children. In step view a step with more than one section tags each file with its section.
 */
export function buildVaultTree(
  entity: VaultEntityGroup,
  view: VaultTreeView,
  closed: Set<string>,
): VaultTreeRow[] {
  const rows: VaultTreeRow[] = [];
  if (view === 'step') {
    for (const phase of entity.phases ?? []) {
      const phaseId = `phase:${phase.phaseKey}`;
      rows.push({ kind: 'folder', id: phaseId, label: phase.phaseLabel, depth: 0, count: phase.docCount });
      if (closed.has(phaseId)) continue;
      for (const milestone of phase.milestones) {
        const stepId = `${phaseId}:${milestone.milestoneId}`;
        rows.push({
          kind: 'folder',
          id: stepId,
          label: milestone.milestoneTitle,
          depth: 1,
          count: milestone.docCount,
        });
        if (closed.has(stepId)) continue;
        const many = milestone.sections.length > 1;
        for (const section of milestone.sections) {
          for (const doc of section.docs) {
            rows.push({ kind: 'file', id: doc.id, doc, depth: 2, tag: many ? section.section : undefined });
          }
        }
      }
    }
    return rows;
  }

  const bySection = new Map<string, VaultDocument[]>();
  for (const milestone of entity.milestones) {
    for (const section of milestone.sections) {
      const list = bySection.get(section.section) ?? [];
      list.push(...section.docs);
      bySection.set(section.section, list);
    }
  }
  for (const [section, docs] of [...bySection.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const id = `cat:${section}`;
    rows.push({ kind: 'folder', id, label: section, depth: 0, count: docs.length });
    if (closed.has(id)) continue;
    for (const doc of docs) rows.push({ kind: 'file', id: doc.id, doc, depth: 1, sub: doc.milestoneTitle });
  }
  return rows;
}
