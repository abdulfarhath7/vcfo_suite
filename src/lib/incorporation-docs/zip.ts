import PizZip from 'pizzip';

import {
  directorAudienceLabel,
  directorFieldPrefix,
  type IncorpDocAudience,
} from '@/lib/incorporation-docs/audiences';
import { incorpDocDownloadFilename, type IncorpDraftDocLink } from '@/lib/incorporation-docs/paths';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { resolvePre6DisplayNameForPrefix } from '@/lib/person-name';
import { slugifyCompanyName } from '@/lib/slug';

/**
 * "Download all" for incorporation drafts: one zip, company documents and one
 * folder per director. The caller decides which links go in (staff: every
 * generated draft; client: only shared rows) — this file never widens that.
 * Board-resolution drafts are not incorporation drafts and never appear here.
 */

export function incorpDraftsZipRoot(companyName: string, slug?: string | null): string {
  return `${slug?.trim() || slugifyCompanyName(companyName)}-incorporation-drafts`;
}

/** Windows- and zip-safe folder name. */
function safeSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Director';
}

export function incorpDraftFolder(audience: IncorpDocAudience, pre6?: ChecklistItemResponses): string {
  if (audience === 'company') return 'Company';
  const name = pre6 ? resolvePre6DisplayNameForPrefix(pre6, directorFieldPrefix(audience)) : '';
  return safeSegment(name || directorAudienceLabel(audience));
}

export interface IncorpDraftZipEntry {
  path: string;
  link: IncorpDraftDocLink;
}

/** Zip paths for the given drafts; duplicate names get a numeric suffix rather than overwriting. */
export function incorpDraftZipEntries(
  links: IncorpDraftDocLink[],
  root: string,
  pre6?: ChecklistItemResponses,
): IncorpDraftZipEntry[] {
  const used = new Set<string>();
  return links.map((link) => {
    const folder = incorpDraftFolder(link.audience, pre6);
    const file = incorpDocDownloadFilename(link.doc, link.audience, { pre6 });
    let path = `${root}/${folder}/${file}`;
    for (let n = 2; used.has(path); n += 1) {
      path = `${root}/${folder}/${file.replace(/\.docx$/i, `-${n}.docx`)}`;
    }
    used.add(path);
    return { path, link };
  });
}

/** Builds the zip; drafts the loader cannot read are listed in `missing`, not fatal. */
export async function buildIncorpDraftsZip(
  entries: IncorpDraftZipEntry[],
  load: (storagePath: string) => Promise<Buffer | null>,
): Promise<{ buffer: Buffer; included: string[]; missing: string[] }> {
  const zip = new PizZip();
  const included: string[] = [];
  const missing: string[] = [];
  for (const entry of entries) {
    const bytes = await load(entry.link.path);
    if (!bytes) {
      missing.push(entry.path);
      continue;
    }
    zip.file(entry.path, bytes);
    included.push(entry.path);
  }
  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  return { buffer, included, missing };
}
