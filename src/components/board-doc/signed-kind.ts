import { fileType } from '@/components/ui/file-badge';
import type { SignedCopy } from './types';

export type SignedKind = 'pdf' | 'image' | 'other';

export function signedKind(file: Pick<SignedCopy, 'name' | 'contentType'>): SignedKind {
  const ct = (file.contentType ?? '').toLowerCase();
  const t = fileType(file.name);
  if (ct.includes('pdf') || t === 'PDF') return 'pdf';
  if (ct.startsWith('image/') || t === 'JPG' || t === 'PNG') return 'image';
  return 'other';
}
