import { downloadDateStamp } from '@/lib/files/download-name';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import { incorpDraftDocLinksFromResponses } from '@/lib/incorporation-docs/paths';
import { filterClientVisibleIncorpDrafts } from '@/lib/incorporation-docs/share';
import {
  buildIncorpDraftsZip,
  incorpDraftsZipRoot,
  incorpDraftZipEntries,
} from '@/lib/incorporation-docs/zip';
import { directorResponsesFromState } from '@/lib/incorporation/proposed-directors';

const { pre6 } = directorResponsesFromState(
  fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta'), director('e3', 'yes', 'Gamma')]),
);

const PRE7 = {
  nrDirectorDir2DraftUrl: 'eng/nrDirectorDir2DraftUrl/1-a.docx',
  residentDirectorDir2DraftUrl: 'eng/residentDirectorDir2DraftUrl/1-b.docx',
  residentDirector2Dir2DraftUrl: 'eng/residentDirector2Dir2DraftUrl/1-c.docx',
  moaDraftUrl: 'eng/moaDraftUrl/1-d.docx',
  boardResolutionDraftForIncorpUrl: 'eng/boardResolutionDraftForIncorpUrl/1-e.docx',
};

const CLIENT = 'Test Company Private Limited';
const root = incorpDraftsZipRoot(CLIENT);
/** GL-08: `<Document>_<Client>_<DD-MM-YYYY>.docx`. */
const named = (doc: string) => `${doc}_Test-Company-Private-Limited_${downloadDateStamp()}.docx`;
const load = async (path: string) => Buffer.from(`bytes:${path}`);

describe('incorporation drafts zip', () => {
  it('lays out Company and one folder per director; no board resolution', async () => {
    const links = incorpDraftDocLinksFromResponses(PRE7, { pre6 });
    const { buffer, included } = await buildIncorpDraftsZip(incorpDraftZipEntries(links, root, pre6, CLIENT), load);
    expect(root).toBe(`Incorporation-Drafts_Test-Company-Private-Limited_${downloadDateStamp()}`);
    expect(included.sort()).toEqual([
      `${root}/Alpha Director/${named('DIR-2-Alpha-Director')}`,
      `${root}/Beta Director/${named('DIR-2-Beta-Director')}`,
      `${root}/Company/${named('INC-33-MOA')}`,
      `${root}/Gamma Director/${named('DIR-2-Gamma-Director')}`,
    ]);
    expect(Object.keys(new PizZip(buffer).files).some((f) => f.includes('board'))).toBe(false);
  });

  it('a client only ever gets shared rows', async () => {
    const pre7State = {
      status: 'in-progress' as const,
      sharedIncorpDraftDocs: ['dir-2:resident-2', 'moa:company'],
    };
    const links = filterClientVisibleIncorpDrafts(PRE7, pre7State, { pre6 });
    const { included } = await buildIncorpDraftsZip(incorpDraftZipEntries(links, root, pre6, CLIENT), load);
    expect(included.sort()).toEqual([
      `${root}/Company/${named('INC-33-MOA')}`,
      `${root}/Gamma Director/${named('DIR-2-Gamma-Director')}`,
    ]);
  });

  it('nothing shared → nothing for the client', () => {
    expect(filterClientVisibleIncorpDrafts(PRE7, { status: 'in-progress' }, { pre6 })).toEqual([]);
  });

  it('unreadable files are reported, not fatal', async () => {
    const links = incorpDraftDocLinksFromResponses({ moaDraftUrl: PRE7.moaDraftUrl, aoaDraftUrl: 'x' }, { pre6 });
    const result = await buildIncorpDraftsZip(incorpDraftZipEntries(links, root, pre6, CLIENT), async (p) =>
      p === 'x' ? null : Buffer.from('ok'),
    );
    expect(result.included).toEqual([`${root}/Company/${named('INC-33-MOA')}`]);
    expect(result.missing).toEqual([`${root}/Company/${named('INC-34-AOA')}`]);
  });
});
