import { describe, expect, it } from 'vitest';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import type { KnowledgeBankFile, KnowledgeBankFolder } from '@/views/knowledge-bank/knowledge-bank-ui-state';
import {
  applyAutoFill,
  clientAutoFill,
  dayLabel,
  fileExt,
  fileFamily,
  fileTag,
  groupByFamily,
  groupPeople,
  kbSearch,
  kbShelfOf,
  kbShelves,
  parseSent,
  previewModeOf,
  pushSent,
  readComposeParams,
  recipientsOf,
  shelfColor,
  sizeLabel,
} from './model';

const person = (over: Partial<DirectoryPerson>): DirectoryPerson => ({
  userId: 'u',
  name: 'Name',
  email: 'n@x.in',
  role: 'client',
  kind: 'client',
  status: 'active',
  reportsToManagerId: null,
  managerName: null,
  projects: [],
  ...over,
});

const folder = (id: string, name: string, parentId: string | null = null): KnowledgeBankFolder => ({ id, name, parentId, createdBy: 'm', createdAt: '2026-10-01T00:00:00Z' });
const file = (id: string, folderId: string | null, over: Partial<KnowledgeBankFile> = {}): KnowledgeBankFile => ({
  id,
  title: `Doc ${id}`,
  description: null,
  fileName: `${id}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  uploadedBy: 'm',
  uploaderName: 'Anita Rao',
  uploaderEmail: 'anita@demo.vcfo.local',
  createdAt: '2026-10-02T00:00:00Z',
  folderId,
  folderPath: '',
  ...over,
});

describe('dates and sizes', () => {
  it('says "16 Oct" this year and adds the year otherwise, in India time', () => {
    expect(dayLabel('2026-10-16', '2026-10-29')).toBe('16 Oct');
    expect(dayLabel('2025-10-16', '2026-10-29')).toBe('16 Oct 2025');
    expect(dayLabel('2026-10-15T20:00:00Z', '2026-10-29')).toBe('16 Oct'); // 1:30 am IST next day
    expect(dayLabel(null)).toBe('—');
  });
  it('labels sizes', () => {
    expect(sizeLabel(2048)).toBe('2 KB');
    expect(sizeLabel(2.5 * 1048576)).toBe('2.5 MB');
    expect(sizeLabel(null)).toBe('');
  });
});

describe('file types', () => {
  it('reads the extension and family', () => {
    expect(fileExt('Rent Agreement.PDF')).toBe('pdf');
    expect(fileExt('noext')).toBe('');
    expect(fileFamily('a.docx')).toBe('word');
    expect(fileFamily('scan.jpeg')).toBe('image');
    expect(fileFamily('x', 'application/pdf')).toBe('pdf');
    expect(fileTag('photo.png')).toEqual({ text: 'png', cls: 'jpg' });
    expect(fileTag('book.xlsx').cls).toBe('xlsx');
  });
  it('previews PDFs and images only', () => {
    expect(previewModeOf('a.pdf')).toBe('pdf');
    expect(previewModeOf('a.webp')).toBe('image');
    expect(previewModeOf('a.docx')).toBe('none');
  });
  it('groups by type in a fixed order, newest first', () => {
    const g = groupByFamily(
      [
        { n: 'b.jpg', d: '2026-10-01' },
        { n: 'a.pdf', d: '2026-10-01' },
        { n: 'c.pdf', d: '2026-10-05' },
      ],
      (x) => x.n,
      (x) => x.d,
    );
    expect(g.map((x) => x.label)).toEqual(['PDFs', 'Photos and scans']);
    expect(g[0]!.items.map((x) => x.n)).toEqual(['c.pdf', 'a.pdf']);
  });
});

describe('compose params (live ComposeMail)', () => {
  it('reads to / subject / body / template and cuts long text as live does', () => {
    const p = readComposeParams(new URLSearchParams({ to: ' rohan@acme.in ', subject: 's'.repeat(400), body: 'b'.repeat(6000), template: 't1' }));
    expect(p.to).toBe('rohan@acme.in');
    expect(p.subject).toHaveLength(300);
    expect(p.body).toHaveLength(5000);
    expect(p.template).toBe('t1');
    expect(readComposeParams(null)).toEqual({ to: null, subject: null, body: null, template: null });
  });
});

describe('To row', () => {
  const people = [
    person({ userId: 'c1', name: 'Mei', email: 'mei@t.in', projects: [{ id: 'e1', slug: 't', companyName: 'Tidewater' }], primaryForProjectIds: ['e1'] }),
    person({ userId: 'c2', name: 'Rohan', email: 'rohan@n.in', projects: [{ id: 'e2', slug: 'n', companyName: 'Northwind' }] }),
    person({ userId: 'l1', name: 'Arjun', email: 'arjun@sbc.in', role: 'intern', kind: 'firm', projects: [{ id: 'e1', slug: 't', companyName: 'Tidewater' }] }),
  ];
  it('a client pick swaps only the contacts the last pick added', () => {
    let selected = new Set<string>(['l1']);
    const first = clientAutoFill(people, selected, [], 'e1');
    expect(first.add).toEqual(['c1']);
    selected = applyAutoFill(selected, first.remove, first.add);
    const second = clientAutoFill(people, selected, first.add, 'e2');
    selected = applyAutoFill(selected, second.remove, second.add);
    expect([...selected].sort()).toEqual(['c2', 'l1']);
  });
  it('lists people first, then typed addresses', () => {
    const r = recipientsOf(people, new Set(['l1', 'c1']), ['ca@bank.in']);
    expect(r.map((x) => x.email)).toEqual(['mei@t.in', 'arjun@sbc.in', 'ca@bank.in']);
  });
  it('groups suggestions as clients then team', () => {
    expect(groupPeople(people).map((g) => [g.label, g.people.length])).toEqual([
      ['Clients', 2],
      ['Team', 1],
    ]);
  });
  it('keeps a short session list of sends and ignores junk', () => {
    const list = pushSent([], { at: '2026-10-29T05:00:00Z', subject: 'A', to: ['a@x.in'] }, 2);
    const two = pushSent(pushSent(list, { at: 'b', subject: 'B', to: [] }, 2), { at: 'c', subject: 'C', to: [] }, 2);
    expect(two.map((x) => x.subject)).toEqual(['C', 'B']);
    expect(parseSent(JSON.stringify(two))).toHaveLength(2);
    expect(parseSent('{bad')).toEqual([]);
    expect(parseSent(JSON.stringify([{ nope: 1 }]))).toEqual([]);
  });
});

describe('knowledge bank', () => {
  const folders = [folder('f-gst', 'GST'), folder('f-inc', 'Incorporation'), folder('f-sub', 'Returns', 'f-gst')];
  const files = [file('1', 'f-gst'), file('2', 'f-sub', { description: 'Every month before the 20th' }), file('3', null, { uploaderName: 'Joseph' })];
  it('makes the top-level folders shelves with every document under them counted', () => {
    expect(kbShelves(folders, files)).toEqual([
      { id: 'f-gst', name: 'GST', files: 2, folders: 1 },
      { id: 'f-inc', name: 'Incorporation', files: 0, folders: 0 },
    ]);
    expect(kbShelfOf('f-sub', folders)).toBe('f-gst');
    expect(kbShelfOf(null, folders)).toBeNull();
  });
  it('searches as live: folder names, and file text or uploader, across the library', () => {
    const hit = kbSearch('month', folders, files);
    expect(hit.files.map((f) => f.id)).toEqual(['2']);
    expect(kbSearch('joseph', folders, files).files.map((f) => f.id)).toEqual(['3']);
    expect(kbSearch('ret', folders, files).folders.map((f) => f.id)).toEqual(['f-sub']);
  });
  it('colours shelves by area, or leaves it to the folder hue', () => {
    expect(shelfColor('GST returns')).toBe('var(--law-GST)');
    expect(shelfColor('Income tax and TDS')).toBe('var(--law-IT)');
    expect(shelfColor('Templates')).toBe('var(--sb-gold)');
    expect(shelfColor('Misc')).toBeNull();
  });
});
