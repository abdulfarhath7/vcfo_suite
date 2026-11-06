import 'server-only';

import { getPortalFilings } from '@/db/repositories/client-compliances';
import { listOpenDocumentRequests } from '@/db/repositories/client-documents';
import { listFileRequests } from '@/db/repositories/client-incorporation';
import { normalizeLabel } from '@/lib/ask/field-catalog/rules';
import type { ChangesetDraft, ChangesetRowDraft } from '@/lib/ask/changeset/types';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { lockedClient } from '../shared';
import type { ActionContext } from '../types';
import { addFilingProof, attachRequestedFile, uploadToRequest } from './index';

/**
 * Which open item a client's file answers, by code and with no model: the words of the message and
 * the file name against each item's label. The best single match goes on a card the client confirms.
 * A tie or no match is not guessed; the file goes on to the data router, and the client is told
 * what is open.
 */
export interface OpenItem {
  kind: 'request' | 'fileRequest' | 'filing';
  id: string;
  label: string;
}

const COMMON_WORDS = new Set(['the', 'for', 'and', 'from', 'with', 'our', 'your', 'copy', 'file', 'document', 'documents', 'please', 'signed', 'scan', 'attached', 'here', 'this', 'of', 'to', 'in', 'on', 'a', 'an']);
const PROOF_WORDS = /\b(?:proof|challan|acknowledg\w*|receipt|arn)\b/i;

const words = (text: string) => new Set(normalizeLabel(text).split(' ').filter((word) => word.length >= 2 && !COMMON_WORDS.has(word)));

/** The one item naming the most words of this text, or null when none does or two tie. */
export function bestItem(text: string, items: readonly OpenItem[]): OpenItem | null {
  const said = words(text);
  const scored = items.map((item) => ({ item, score: [...words(item.label)].filter((word) => said.has(word)).length })).sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  return first && first.score > 0 && first.score !== second?.score ? first.item : null;
}

const proofKind = (text: string) => (/challan/i.test(text) ? 'challan' : /acknowledg|\barn\b/i.test(text) ? 'acknowledgement' : 'other');
const nameOnly = (fileName: string) => fileName.replace(/\.[a-z0-9]+$/i, '');

export interface ClientFileMatch {
  draft: ChangesetDraft | null;
  /** What is still open, or what could not be placed, for the chat line. */
  note: string;
}

export async function matchClientFiles(actx: ActionContext, files: ReadonlyArray<{ id: string; fileName: string }>, message: string): Promise<ClientFileMatch> {
  const engagementId = lockedClient(actx);
  const wantsProof = PROOF_WORDS.test([message, ...files.map((f) => f.fileName)].join(' '));
  const [requests, fileRequests, filings] = await Promise.all([
    listOpenDocumentRequests(actx.auth, engagementId),
    listFileRequests(actx.auth, engagementId),
    wantsProof ? getPortalFilings(actx.auth) : Promise.resolve([]),
  ]);
  const items: OpenItem[] = [
    ...requests.map((r) => ({ kind: 'request' as const, id: r.id, label: r.title })),
    ...fileRequests.filter((r) => !r.fulfilledAt).map((r) => ({ kind: 'fileRequest' as const, id: r.id, label: r.label })),
    ...filings.filter((f) => !f.filedOn && engagementDbId(f.engagementId) === engagementDbId(engagementId)).map((f) => ({ kind: 'filing' as const, id: f.id, label: `${f.name} ${f.period}` })),
  ];
  const open = items.filter((item) => item.kind !== 'filing').map((item) => item.label);
  const stillOpen = open.length > 0 ? ` Still open: ${open.slice(0, 5).join(', ')}. Attach the file again and say which one it is for.` : '';

  const byRequest = new Map<string, typeof files[number][]>();
  const rows: ChangesetRowDraft[] = [];
  const recipients = new Map<string, NonNullable<ChangesetDraft['recipients']>[number]>();
  const unplaced: string[] = [];
  const add = (draft: ChangesetDraft | null, fileName: string, attachmentId?: string) => {
    for (const row of draft?.rows ?? []) rows.push({ ...row, source: { kind: 'attachment', fileName, ...(attachmentId ? { attachmentId } : {}) } });
    for (const person of draft?.recipients ?? []) recipients.set(person.name, person);
  };
  const taken = new Set<string>();
  for (const file of files) {
    const text = `${message} ${nameOnly(file.fileName)}`;
    const item = bestItem(text, items);
    if (!item || (item.kind === 'fileRequest' && taken.has(item.id))) {
      unplaced.push(file.fileName);
    } else if (item.kind === 'request') {
      byRequest.set(item.id, [...(byRequest.get(item.id) ?? []), file]);
    } else if (item.kind === 'fileRequest') {
      taken.add(item.id);
      add(await attachRequestedFile.preview(actx, { requestId: item.id, attachmentId: file.id }), file.fileName, file.id);
    } else {
      add(await addFilingProof.preview(actx, { filingId: item.id, attachmentId: file.id, kind: proofKind(text) }), file.fileName, file.id);
    }
  }
  for (const [requestId, group] of byRequest) {
    add(await uploadToRequest.preview(actx, { requestId, attachmentIds: group.map((f) => f.id) }), group.map((f) => f.fileName).join(', '));
  }
  if (rows.length === 0) return { draft: null, note: stillOpen };
  const outward = recipients.size > 0;
  return {
    draft: {
      title: rows.length === 1 ? rows[0]!.label : 'Send your files',
      tier: outward ? 'T3' : 'T2',
      engagementId,
      rows,
      ...(outward ? { recipients: [...recipients.values()] } : {}),
    },
    note: unplaced.length > 0 ? ` I could not tell what ${unplaced.join(', ')} is for.${stillOpen}` : '',
  };
}
