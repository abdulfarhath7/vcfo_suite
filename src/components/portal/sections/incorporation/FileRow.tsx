'use client';

import { type ReactNode } from 'react';
import { Icon } from '../../ui';

/** File type tile text for `.drow3 .fi` (PDF red, DOCX blue, JPG green). */
export function fileKind(name: string, contentType?: string): 'PDF' | 'DOCX' | 'JPG' | 'XLSX' {
  const n = name.toLowerCase();
  if (/\.(xlsx?|csv)$/.test(n) || /sheet|excel/.test(contentType ?? '')) return 'XLSX';
  if (/\.(docx?|rtf)$/.test(n) || /word/.test(contentType ?? '')) return 'DOCX';
  if (/\.(jpe?g|png|webp|gif)$/.test(n) || /^image\//.test(contentType ?? '')) return 'JPG';
  return 'PDF';
}

/** One file on a step (prototype `.drow3`): tile, name, meta line, status chip, open / download. */
export function FileRow({
  name,
  meta,
  kind,
  chip,
  onOpen,
  onDownload,
  extra,
}: {
  name: string;
  meta?: string;
  kind: ReturnType<typeof fileKind>;
  chip?: ReactNode;
  onOpen?: () => void;
  onDownload?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="drow3 sw-file">
      <span className={'fi ' + kind}>{kind}</span>
      <div style={{ minWidth: 0 }}>
        <div className="nm">{name}</div>
        {meta ? <div className="mt">{meta}</div> : null}
      </div>
      <div className="st2">
        {chip ?? null}
        {extra ?? null}
        {onOpen ? (
          <button type="button" className="ib sw-ib" aria-label={`Open ${name}`} title="Open" onClick={onOpen}>
            <Icon name="eye" />
          </button>
        ) : null}
        {onDownload ? (
          <button type="button" className="ib sw-ib" aria-label={`Download ${name}`} title="Download" onClick={onDownload}>
            <Icon name="dl" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
