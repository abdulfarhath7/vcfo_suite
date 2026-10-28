import { cn } from '@/lib/utils';

export type FileType = 'PDF' | 'DOCX' | 'XLSX' | 'JPG' | 'PNG' | 'ZIP' | 'CSV' | 'TXT';

/* R-26: PDF red, DOCX blue, XLSX green, JPG and PNG violet, ZIP grey. */
const TONES: Record<FileType, string> = {
  PDF: 'bg-danger-soft text-danger',
  DOCX: 'bg-info-soft text-info',
  XLSX: 'bg-positive-soft text-positive',
  CSV: 'bg-positive-soft text-positive',
  JPG: 'bg-identity-soft text-identity',
  PNG: 'bg-identity-soft text-identity',
  ZIP: 'bg-upcoming-soft text-upcoming',
  TXT: 'bg-upcoming-soft text-upcoming',
};

export function fileType(name: string): FileType {
  const ext = name.split('.').pop()?.toUpperCase() ?? '';
  if (ext === 'JPEG') return 'JPG';
  if (ext === 'DOC') return 'DOCX';
  if (ext === 'XLS') return 'XLSX';
  return (ext in TONES ? ext : 'TXT') as FileType;
}

export function FileBadge({ type, name, className }: { type?: FileType; name?: string; className?: string }) {
  const t = type ?? fileType(name ?? '');
  return (
    <span className={cn('inline-flex h-6 w-11 flex-none items-center justify-center rounded-mark font-mono text-[11px] font-medium', TONES[t], className)}>
      {t}
    </span>
  );
}
