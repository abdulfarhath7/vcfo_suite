import { describe, expect, it } from 'vitest';

import type { PublicDownloadFile, PublicDownloadGroup } from '@/lib/document-downloads/catalog';
import {
  attachmentFilesUnavailableReason,
  filesForSpiceAttachment,
} from '@/lib/document-downloads/spice-attachment-files';

function file(key: string, ready = true, reason?: string): PublicDownloadFile {
  return { key, label: key, fileName: `${key}.docx`, kind: key.startsWith('upload') ? 'uploaded' : 'generated', ready, ...(reason ? { reason } : {}) };
}

const root: PublicDownloadGroup = {
  id: 'all',
  label: 'All',
  zipLabel: 'All',
  files: [],
  groups: [
    {
      id: 'part-a',
      label: 'A',
      zipLabel: 'A',
      files: [file('pack:board-resolution:company'), file('br-signed'), file('upload:pre-1:certificateOfIncorporationUrl'), file('upload:pre-1:passportUrl')],
      groups: [],
    },
    {
      id: 'part-b',
      label: 'B',
      zipLabel: 'B',
      files: [
        file('pack:dir-2:resident'),
        file('pack:dir-2:non-resident', false, 'Needs 2 more answers'),
        file('pack:moa:company', false, 'Needs 1 more answer'),
        file('upload:pre-14:registeredOfficeNocUrl'),
        file('upload:pre-15:directors.e1.passportUrl'),
      ],
      groups: [],
    },
  ],
};

describe('SPICe+ attachment files', () => {
  it('maps each row to its own files', () => {
    const keys = (row: string) => filesForSpiceAttachment(row, root).map((f) => f.key);
    expect(keys('board-resolution')).toEqual(['pack:board-resolution:company', 'br-signed']);
    expect(keys('parent-proof')).toEqual(['upload:pre-1:certificateOfIncorporationUrl']);
    expect(keys('dir-2')).toEqual(['pack:dir-2:resident', 'pack:dir-2:non-resident']);
    expect(keys('office-proof')).toEqual(['upload:pre-14:registeredOfficeNocUrl']);
    expect(keys('director-kyc')).toEqual(['upload:pre-15:directors.e1.passportUrl']);
    expect(keys('aoa')).toEqual([]);
    expect(keys('unknown')).toEqual([]);
    expect(filesForSpiceAttachment('moa', null)).toEqual([]);
  });

  it('turns the icons off with a reason only when no file is ready', () => {
    expect(attachmentFilesUnavailableReason(filesForSpiceAttachment('dir-2', root), 'Waiting')).toBeNull();
    expect(attachmentFilesUnavailableReason(filesForSpiceAttachment('moa', root), 'Waiting')).toBe('No file yet: Needs 1 more answer');
    expect(attachmentFilesUnavailableReason([], 'Not asked yet')).toBe('No file yet: Not asked yet');
  });
});
