import type { NocVariant } from '@/lib/noc/variant';

/**
 * Registry for the NOC templates. The NOC is the parent's Pre-2 board
 * resolution: `templateRelative` is the firm's blank Word file, kept as
 * supplied and shown in the Create Project preview; `generationTemplateRelative`
 * is the tagged copy Pre-2 renders (built by the prepare scripts). NOC kinds are
 * deliberately not in `INCORP_DOC_DEFINITIONS` or the doc-pack registry — the
 * existing board-resolution entry already covers them.
 */
export interface NocTemplateDefinition {
  variant: NocVariant;
  label: string;
  templateRelative: string;
  downloadFilename: string;
  /** Tagged template the Pre-2 board resolution renders from. */
  generationTemplateRelative: string;
  /** Merge keys beyond the shared board-resolution set. */
  mergeFieldKeys: readonly string[];
  /** False while the firm has not supplied the file — the preview is hidden. */
  templateAvailable: boolean;
}

export const NOC_TEMPLATES: Record<NocVariant, NocTemplateDefinition> = {
  'foreign-parent': {
    variant: 'foreign-parent',
    label: 'NOC — Foreign subsidiary',
    templateRelative: 'public/templates/noc-foreign-parent.docx',
    downloadFilename: 'noc-foreign-parent.docx',
    generationTemplateRelative: 'public/templates/boardResolution.docx',
    mergeFieldKeys: [],
    templateAvailable: true,
  },
  'indian-name-only': {
    variant: 'indian-name-only',
    label: 'NOC — Indian subsidiary (name use)',
    templateRelative: 'public/templates/noc-indian-name-only.docx',
    downloadFilename: 'noc-indian-name-only.docx',
    generationTemplateRelative: 'public/templates/boardResolution-indian-name-only.docx',
    mergeFieldKeys: ['PROPOSED_NAME_2', 'RESOLUTION_DAY', 'NAME_WORD', 'SIGNATORY_DIN'],
    templateAvailable: true,
  },
  'indian-investing': {
    variant: 'indian-investing',
    label: 'NOC — Indian subsidiary (investing)',
    templateRelative: 'public/templates/noc-indian-investing.docx',
    downloadFilename: 'noc-indian-investing.docx',
    generationTemplateRelative: 'public/templates/boardResolution-indian-investing.docx',
    mergeFieldKeys: [],
    templateAvailable: true,
  },
};

/**
 * Public URL of the blank template — files under `public/` are served from the
 * site root. Blank templates hold no client data, so no auth route is needed.
 */
export function nocTemplatePreviewUrl(variant: NocVariant): string | null {
  const def = NOC_TEMPLATES[variant];
  if (!def.templateAvailable) return null;
  return '/' + def.templateRelative.replace(/^public\//, '');
}
