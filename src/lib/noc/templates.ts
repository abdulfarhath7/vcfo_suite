import type { NocVariant } from '@/lib/noc/variant';

/**
 * Registry for the future NOC generator. Shaped like `INCORP_DOC_DEFINITIONS`
 * so wiring it into generation later is a move, not a rewrite. The template
 * files do not exist yet — nothing reads `templateRelative` in this build, and
 * NOC kinds are deliberately not in `INCORP_DOC_DEFINITIONS` or the doc-pack
 * registry (they would count against pre-7 "all generated").
 */
export interface NocTemplateDefinition {
  variant: NocVariant;
  label: string;
  templateRelative: string;
  downloadFilename: string;
  /** Merge keys the template expects. Empty until the templates arrive. */
  mergeFieldKeys: readonly string[];
}

export const NOC_TEMPLATES: Record<NocVariant, NocTemplateDefinition> = {
  'foreign-parent': {
    variant: 'foreign-parent',
    label: 'NOC — Foreign subsidiary',
    templateRelative: 'public/templates/noc-foreign-parent.docx',
    downloadFilename: 'noc-foreign-parent.docx',
    mergeFieldKeys: [],
  },
  'indian-name-only': {
    variant: 'indian-name-only',
    label: 'NOC — Indian subsidiary (name use)',
    templateRelative: 'public/templates/noc-indian-name-only.docx',
    downloadFilename: 'noc-indian-name-only.docx',
    mergeFieldKeys: [],
  },
  'indian-investing': {
    variant: 'indian-investing',
    label: 'NOC — Indian subsidiary (investing)',
    templateRelative: 'public/templates/noc-indian-investing.docx',
    downloadFilename: 'noc-indian-investing.docx',
    mergeFieldKeys: [],
  },
};
