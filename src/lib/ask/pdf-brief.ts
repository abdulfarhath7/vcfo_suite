import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Brief } from './pdf-brief-document';
import { standardDownloadName } from '@/lib/files/download-name';
import type { BriefItem } from './pdf-brief-types';
import { StatusBriefDocument } from './pdf-status-brief-document';
import type { StatusBrief } from './status-brief';

export { BRIEF_DISCLAIMER, type BriefItem } from './pdf-brief-types';

/**
 * Branded PDF brief of saved explanations (F3) — for the client to forward to
 * their parent company.
 */

function loadLogo(): string | null {
  try {
    const png = readFileSync(path.join(process.cwd(), 'public', 'sbc-logo-light.png'));
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function renderBriefPdf(input: {
  items: BriefItem[];
  companyName: string;
  firmName: string;
  now?: Date;
}): Promise<Buffer> {
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(input.now ?? new Date());
  return renderToBuffer(
    createElement(Brief, {
      items: input.items,
      companyName: input.companyName,
      firmName: input.firmName,
      logo: loadLogo(),
      date,
    }) as Parameters<typeof renderToBuffer>[0],
  );
}

/** C4: the monthly status brief as a PDF. */
export async function renderStatusBriefPdf(input: { brief: StatusBrief; firmName: string; now?: Date }): Promise<Buffer> {
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(input.now ?? new Date());
  return renderToBuffer(
    createElement(StatusBriefDocument, {
      brief: input.brief,
      firmName: input.firmName,
      logo: loadLogo(),
      date,
    }) as Parameters<typeof renderToBuffer>[0],
  );
}

/** GL-08: `<Title or Brief>_<Client>_<DD-MM-YYYY>.pdf`. */
export function briefFilename(companyName: string, single?: string, on: Date = new Date()): string {
  return standardDownloadName(single?.trim() || 'Brief', companyName, 'pdf', on);
}
