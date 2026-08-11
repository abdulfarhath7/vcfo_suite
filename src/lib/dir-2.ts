export type Dir2DirectorKind = import('@/lib/incorporation-docs/shared').IncorpDirectorKind;

export {
  buildDir2MergeFields,
  DIR2_MERGE_FIELD_KEYS,
  type Dir2MergeFields,
} from '@/lib/incorporation-docs/dir2';

export type Dir2MergeInput = import('@/lib/incorporation-docs/shared').IncorpMergeInput & {
  overrides?: Partial<import('@/lib/incorporation-docs/dir2').Dir2MergeFields>;
};

export function dir2DownloadFilename(director: Dir2DirectorKind): string {
  return director === 'non-resident'
    ? 'dir-2-non-resident-director.docx'
    : 'dir-2-resident-director.docx';
}
