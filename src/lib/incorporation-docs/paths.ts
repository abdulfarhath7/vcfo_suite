import {
  audiencesForDoc,
  draftUrlFieldFor,
  INCORP_DOC_DEFINITIONS,
  isCompanyIncorpDoc,
  type IncorpDocKind,
} from '@/lib/incorporation-docs/types';
import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { resolvePre6DirectorDisplayName } from '@/lib/person-name';
import { slugifyCompanyName } from '@/lib/slug';

export type IncorpDocPaths = Partial<Record<IncorpDocKind, Partial<Record<IncorpDocAudience, string>>>>;

export type IncorpDraftDocLink = {
  path: string;
  label: string;
  doc: IncorpDocKind;
  audience: IncorpDocAudience;
};

const DIRECTOR_LABEL: Record<'non-resident' | 'resident', string> = {
  'non-resident': 'Non-resident Director',
  resident: 'Resident Director',
};

export type IncorpDraftLabelOptions = {
  pre6?: ChecklistItemResponses;
};

function directorDisplayName(
  audience: IncorpDocAudience,
  options?: IncorpDraftLabelOptions,
): string {
  if (audience === 'company' || !options?.pre6) return '';
  return resolvePre6DirectorDisplayName(options.pre6, audience);
}

/** UI label for an incorporation draft row (e.g. Pre-7 generate list, client download). */
export function incorpDraftDocLabel(
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
  options?: IncorpDraftLabelOptions,
): string {
  const def = INCORP_DOC_DEFINITIONS[doc];
  if (audience === 'company' || isCompanyIncorpDoc(doc)) {
    return `${def.label} draft`;
  }
  const base = `${def.label} draft — ${DIRECTOR_LABEL[audience]}`;
  const displayName = directorDisplayName(audience, options);
  return displayName ? `${base} - ${displayName}` : base;
}

/** Storage / Content-Disposition filename for a generated incorporation draft. */
export function incorpDocDownloadFilename(
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
  options?: IncorpDraftLabelOptions,
): string {
  const base = INCORP_DOC_DEFINITIONS[doc].downloadFilename(audience);
  if (audience === 'company') return base;
  const displayName = directorDisplayName(audience, options);
  if (!displayName) return base;
  const slug = slugifyCompanyName(displayName);
  return base.replace(/\.docx$/i, `-${slug}.docx`);
}

/** Flatten API `paths` into checklist response field ids → storage paths. */
export function responsePatchFromPaths(paths: IncorpDocPaths): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const doc of Object.keys(paths) as IncorpDocKind[]) {
    const byAudience = paths[doc];
    if (!byAudience) continue;
    for (const audience of Object.keys(byAudience) as IncorpDocAudience[]) {
      const storagePath = byAudience[audience]?.trim();
      const fieldId = draftUrlFieldFor(doc, audience);
      if (storagePath && fieldId) {
        patch[fieldId] = storagePath;
      }
    }
  }
  return patch;
}

export function incorpDraftDocLinksFromResponses(
  responses: ChecklistItemResponses,
  options?: IncorpDraftLabelOptions,
): IncorpDraftDocLink[] {
  const links: IncorpDraftDocLink[] = [];
  for (const doc of Object.keys(INCORP_DOC_DEFINITIONS) as IncorpDocKind[]) {
    for (const audience of audiencesForDoc(doc)) {
      const fieldId = draftUrlFieldFor(doc, audience);
      if (!fieldId) continue;
      const path = responses[fieldId]?.trim();
      if (path) {
        links.push({
          path,
          label: incorpDraftDocLabel(doc, audience, options),
          doc,
          audience,
        });
      }
    }
  }
  return links;
}

export function incorpDraftDocLinksFromPaths(
  paths: IncorpDocPaths,
  options?: IncorpDraftLabelOptions,
): { path: string; label: string }[] {
  return incorpDraftDocLinksFromResponses(responsePatchFromPaths(paths), options);
}

export function incorpDocRowKey(doc: IncorpDocKind, audience: IncorpDocAudience): string {
  return `${doc}:${audience}`;
}

export type IncorpDraftDocSlot = {
  doc: IncorpDocKind;
  audience: IncorpDocAudience;
  label: string;
  path: string;
};

/** Every incorporation draft slot, with storage path when already saved on Pre-7. */
export function incorpDraftDocSlotsFromResponses(
  responses: ChecklistItemResponses,
  options?: IncorpDraftLabelOptions,
): IncorpDraftDocSlot[] {
  const slots: IncorpDraftDocSlot[] = [];
  for (const doc of Object.keys(INCORP_DOC_DEFINITIONS) as IncorpDocKind[]) {
    for (const audience of audiencesForDoc(doc)) {
      const fieldId = draftUrlFieldFor(doc, audience);
      if (!fieldId) continue;
      slots.push({
        doc,
        audience,
        label: incorpDraftDocLabel(doc, audience, options),
        path: responses[fieldId]?.trim() ?? '',
      });
    }
  }
  return slots;
}

/** @deprecated Use audience — alias for migration. */
export type IncorpDraftDocSlotLegacy = IncorpDraftDocSlot & { director: IncorpDocAudience };
