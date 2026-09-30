import type { NocVariant } from '@/lib/noc/variant';

/**
 * Registry for the NOC templates. Shaped like `INCORP_DOC_DEFINITIONS` so
 * wiring it into generation later is a move, not a rewrite. The two Indian
 * templates are the firm's blank files, kept byte-for-byte as supplied; the
 * foreign-parent template has not been provided yet. NOC kinds are deliberately
 * not in `INCORP_DOC_DEFINITIONS` or the doc-pack registry (they would count
 * against pre-7 "all generated").
 */
export interface NocTemplateDefinition {
  variant: NocVariant;
  label: string;
  templateRelative: string;
  downloadFilename: string;
  /** Merge keys the template expects. Empty until the generator is built. */
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
    mergeFieldKeys: [],
    templateAvailable: false,
  },
  'indian-name-only': {
    variant: 'indian-name-only',
    label: 'NOC — Indian subsidiary (name use)',
    templateRelative: 'public/templates/noc-indian-name-only.docx',
    downloadFilename: 'noc-indian-name-only.docx',
    mergeFieldKeys: [],
    templateAvailable: true,
  },
  'indian-investing': {
    variant: 'indian-investing',
    label: 'NOC — Indian subsidiary (investing)',
    templateRelative: 'public/templates/noc-indian-investing.docx',
    downloadFilename: 'noc-indian-investing.docx',
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
