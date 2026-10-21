export type Dir2DirectorKind = import('@/lib/incorporation-docs/shared').IncorpDirectorKind;

export { buildDir2MergeFields } from '@/lib/incorporation-docs/dir2';

export function dir2DownloadFilename(director: Dir2DirectorKind): string {
  return director === 'non-resident'
    ? 'dir-2-non-resident-director.docx'
    : 'dir-2-resident-director.docx';
}
