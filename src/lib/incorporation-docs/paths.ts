import {
  audiencesForDoc,
  draftUrlFieldFor,
  INCORP_DOC_DEFINITIONS,
  isCompanyIncorpDoc,
  type IncorpDocKind,
} from '@/lib/incorporation-docs/types';
import {
  audienceForDirectorFieldId,
  directorAudienceLabel,
  directorAudiencesFromPre6,
  directorFieldPrefix,
  isLegacyDirectorAudience,
  sortDirectorAudiences,
  type IncorpDirectorAudience,
  type IncorpDocAudience,
} from '@/lib/incorporation-docs/audiences';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { resolvePre6DisplayNameForPrefix } from '@/lib/person-name';
import { slugifyCompanyName } from '@/lib/slug';

export type IncorpDocPaths = Partial<Record<IncorpDocKind, Partial<Record<IncorpDocAudience, string>>>>;

export type IncorpDraftDocLink = {
  path: string;
  label: string;
  doc: IncorpDocKind;
  audience: IncorpDocAudience;
};

export type IncorpDraftLabelOptions = {
  /** Director KYC in the `pre-6` shape — names for labels, and which director slots exist. */
  pre6?: ChecklistItemResponses;
  /** Explicit director audiences; wins over the ones read off `pre6`. */
  directors?: readonly IncorpDirectorAudience[];
  /**
   * Pre-7 was already shared or accepted: slots that did not exist before
   * per-director generation become optional so finished work does not reopen.
   */
  frozen?: boolean;
};

function directorDisplayName(
  audience: IncorpDocAudience,
  options?: IncorpDraftLabelOptions,
): string {
  if (audience === 'company' || !options?.pre6) return '';
  return resolvePre6DisplayNameForPrefix(options.pre6, directorFieldPrefix(audience));
}

/**
 * Director audiences to lay out slots for: the directors on file plus any
 * audience that already holds a stored draft, so nothing generated disappears.
 */
export function incorpDirectorAudiences(
  responses: ChecklistItemResponses,
  options?: IncorpDraftLabelOptions,
): IncorpDirectorAudience[] {
  const base = options?.directors?.length
    ? [...options.directors]
    : directorAudiencesFromPre6(options?.pre6);
  const stored: IncorpDirectorAudience[] = [];
  for (const [key, value] of Object.entries(responses)) {
    if (!key.endsWith('DraftUrl') || !value?.trim()) continue;
    const audience = audienceForDirectorFieldId(key);
    if (audience) stored.push(audience);
  }
  return sortDirectorAudiences([...base, ...stored]);
}

function isOptionalSlot(
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
  options?: IncorpDraftLabelOptions,
): boolean {
  if (INCORP_DOC_DEFINITIONS[doc].optional) return true;
  return Boolean(options?.frozen) && !isLegacyDirectorAudience(audience);
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
  const base = `${def.label} draft — ${directorAudienceLabel(audience)}`;
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
  const directors = incorpDirectorAudiences(responses, options);
  for (const doc of Object.keys(INCORP_DOC_DEFINITIONS) as IncorpDocKind[]) {
    for (const audience of audiencesForDoc(doc, directors, options?.pre6, { ignoreAppliesTo: true })) {
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
  /** Not needed for "all generated" (optional doc, or a new slot on a frozen pre-7). */
  optional?: boolean;
};

/** Every incorporation draft slot, with storage path when already saved on Pre-7. */
export function incorpDraftDocSlotsFromResponses(
  responses: ChecklistItemResponses,
  options?: IncorpDraftLabelOptions,
): IncorpDraftDocSlot[] {
  const slots: IncorpDraftDocSlot[] = [];
  const directors = incorpDirectorAudiences(responses, options);
  for (const doc of Object.keys(INCORP_DOC_DEFINITIONS) as IncorpDocKind[]) {
    for (const audience of audiencesForDoc(doc, directors, options?.pre6)) {
      const fieldId = draftUrlFieldFor(doc, audience);
      if (!fieldId) continue;
      const path = responses[fieldId]?.trim() ?? '';
      slots.push({
        doc,
        audience,
        label: incorpDraftDocLabel(doc, audience, options),
        path,
        ...(isOptionalSlot(doc, audience, options) ? { optional: true } : {}),
      });
    }
  }
  return slots;
}
