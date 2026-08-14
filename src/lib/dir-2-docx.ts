import 'server-only';

import { DIR2_MERGE_FIELD_KEYS, type Dir2MergeFields } from '@/lib/incorporation-docs/dir2';

export {
  renderDir2DocxBuffer,
  getIncorpTemplateFingerprint as getDir2TemplateFingerprint,
} from '@/lib/incorporation-docs/docx';

export const DIR2_TEMPLATE_RELATIVE = 'public/templates/dir-2.docx';

export function dir2TemplatePath(): string {
  return `${process.cwd()}/${DIR2_TEMPLATE_RELATIVE}`;
}

export function dir2FieldsToDocxData(fields: Dir2MergeFields): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of DIR2_MERGE_FIELD_KEYS) {
    data[key] = fields[key] ?? '';
  }
  return data;
}
