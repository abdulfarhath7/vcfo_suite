import { describe, expect, it } from 'vitest';
import { buildBoardResolutionMergeFields, generateBoardResolutionDraft } from '@/lib/board-resolution/board-resolution';
import { resolveNocVariant } from '@/lib/noc/variant';
import { docDate, docDay } from './format';
import { DOC_TYPES, nocDocType } from './doc-types';
import { todoStates, trackStates } from './track';
import { isPlaceholder, segmentText } from './merge-segments';
import { diffValues } from './version-diff';
import { nocDocModel, nocEvidence, nocMergeValues, plainDocDate } from './noc-doc';

const foreign = { ownershipType: 'subsidiary', companyType: 'foreign', parentIndianRelationship: null, parentEntityName: 'Northwind Inc.', parentEntityAddress: '548 Market Street, San Francisco', parentEntityRegistrationNumber: null, companyName: 'Northwind India' };
const pre1 = { parentEntityName: 'Northwind Inc.', proposedName1: 'Northwind Technologies India Private Limited', signatoryName: 'Rohan Kumar', signatoryDesignation: 'Director', boardResolutionDate: '2026-09-24' };

describe('docDay', () => {
  it('prints the India day for a timestamp and a plain day', () => {
    expect(docDay('2026-10-13T20:00:00Z')).toBe('14 Oct');
    expect(docDay('2026-09-28')).toBe('28 Sep');
    expect(docDate('2026-09-28')).toBe('28 Sep 2026');
    expect(docDay('')).toBe('');
    expect(docDay('nonsense')).toBe('');
  });
});

describe('nocDocType', () => {
  it('gives a foreign parent six steps, five to-do lines and six checks', () => {
    const t = nocDocType('foreign-parent');
    expect(t.stages.map((s) => s.label)).toEqual(['Drafted', 'Released', 'Signed', 'Notarised', 'Apostilled', 'Accepted']);
    expect(t.todo).toHaveLength(5);
    expect(t.checks.map((c) => c.label)).toContain('Apostille certificate');
    expect(t.checks).toHaveLength(6);
    expect(t.title).toBe('Board resolution (NOC)');
    expect(t.subtitle).toBe('NOC — Foreign subsidiary');
  });

  it('gives an Indian parent four steps, four to-do lines and four checks', () => {
    for (const v of ['indian-name-only', 'indian-investing', null] as const) {
      const t = nocDocType(v);
      expect(t.stages.map((s) => s.label)).toEqual(['Drafted', 'Released', 'Signed', 'Accepted']);
      expect(t.todo).toHaveLength(4);
      expect(t.checks).toHaveLength(4);
      expect(t.checks.map((c) => c.label)).not.toContain('Notary stamp');
    }
  });

  it('drops the notary and apostille steps when SBC turns them off', () => {
    expect(nocDocType('foreign-parent', { notary: false }).stages).toHaveLength(4);
  });

  it('describes the later board meeting documents on the company letterhead', () => {
    expect(DOC_TYPES.minutes.letterhead).toBe('company');
    expect(DOC_TYPES.resolutionByCirculation.stages.map((s) => s.label)).toContain('In next agenda');
  });
});

describe('trackStates and todoStates', () => {
  const type = nocDocType('foreign-parent');
  it('marks dated steps done and the first open step now', () => {
    const s = trackStates(type.stages, { drafted: { at: '2026-09-26', by: 'SBC' }, released: { at: '2026-09-28', by: 'SBC' } });
    expect(s.map((x) => x.state)).toEqual(['done', 'done', 'now', 'next', 'next', 'next']);
    expect(s[1]!.by).toBe('SBC');
  });

  it('ticks the to-do lines from the same records', () => {
    expect(todoStates(type, { released: { at: '2026-09-28' } }).map((x) => x.state)).toEqual(['now', 'next', 'next', 'next', 'next']);
    expect(todoStates(type, { released: { at: 'x' }, signed: { at: 'x' }, notarised: { at: 'x' }, apostilled: { at: 'x' } }).map((x) => x.state)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'now',
    ]);
    expect(todoStates(type, { accepted: { at: '2026-10-08' } }).every((x) => x.state === 'done')).toBe(true);
    expect(todoStates(type, { uploaded: { at: '2026-10-06' } }).at(-1)!.state).toBe('done');
  });
});

describe('segmentText', () => {
  const values = [
    { key: 'A', value: 'Northwind', source: 'a' },
    { key: 'B', value: 'Northwind Technologies India', source: 'b' },
    { key: 'C', value: 'x', source: 'c' },
  ];
  it('takes the longest value first and never overlaps', () => {
    const segs = segmentText('Northwind Technologies India is owned by Northwind.', values);
    expect(segs.filter((s) => s.field).map((s) => [s.field!.key, s.text])).toEqual([
      ['B', 'Northwind Technologies India'],
      ['A', 'Northwind'],
    ]);
    expect(segs.map((s) => s.text).join('')).toBe('Northwind Technologies India is owned by Northwind.');
  });

  it('keeps plain text when nothing matches', () => {
    expect(segmentText('Plain text', values)).toEqual([{ text: 'Plain text' }]);
  });

  it('knows a placeholder', () => {
    expect(isPlaceholder('[Designation]')).toBe(true);
    expect(isPlaceholder('__________')).toBe(true);
    expect(isPlaceholder('Director')).toBe(false);
  });
});

describe('diffValues', () => {
  it('lists changed, added and removed values in label order', () => {
    const rows = diffValues({ A: 'Lee', B: 'same', C: 'gone' }, { A: 'Carter', B: 'same', D: 'new' }, { D: 'Dee', A: 'Nominee' });
    expect(rows).toEqual([
      { key: 'D', label: 'Dee', before: '', after: 'new' },
      { key: 'A', label: 'Nominee', before: 'Lee', after: 'Carter' },
      { key: 'C', label: 'C', before: 'gone', after: '' },
    ]);
  });
});

describe('NOC adapters', () => {
  const fields = buildBoardResolutionMergeFields({ engagement: foreign as never, pre1 });

  it('builds merge values with sources and marks placeholders missing', () => {
    const values = nocMergeValues(fields);
    const parent = values.find((v) => v.key === 'PARENT_ENTITY_NAME')!;
    expect(parent.value).toBe('Northwind Inc.');
    expect(parent.source).toBe('Pre-1 · Parent company name');
    expect(values.find((v) => v.key === 'SIGNATORY_DIN')!.missing).toBe(true);
    expect(nocMergeValues(null)).toEqual([]);
  });

  it('labels the foreign draft with the five margin labels and two dates', () => {
    const content = generateBoardResolutionDraft({ engagement: foreign as never, pre1 });
    const m = nocDocModel({ content, fields });
    expect(m.heading).toMatch(/^CERTIFIED TRUE COPY/);
    expect(m.letterhead?.name).toBe('Northwind Inc.');
    expect(m.sections.map((s) => s.label)).toEqual(['Purpose', 'Decision', 'Who signs', 'Filing agent', 'Certifies']);
    expect(m.dates).toEqual([
      { label: 'Meeting', value: '24 Sep 2026' },
      { label: 'Certified', value: '24 Sep 2026' },
    ]);
    expect(m.sections.at(-1)!.paragraphs).toContain('CERTIFIED TRUE COPY');
  });

  it('labels the name-use draft too', () => {
    const indian = { ...foreign, companyType: 'domestic', parentIndianRelationship: 'name_only' };
    const content = generateBoardResolutionDraft({ engagement: indian as never, pre1 });
    const m = nocDocModel({ content, fields });
    expect(m.sections.map((s) => s.label)).toEqual(['Decision', 'Filing agent', 'Certifies']);
  });

  it('draws a plain page when the parent name is unknown, and reads structured content', () => {
    const blank = buildBoardResolutionMergeFields({});
    const content = JSON.stringify({ br: 1, paragraphs: [{ text: 'RESOLVED THAT one', align: 'left' }] });
    const m = nocDocModel({ content, fields: blank });
    expect(m.letterhead).toBeNull();
    expect(m.sections).toEqual([{ label: 'Decision', paragraphs: ['RESOLVED THAT one'] }]);
    expect(plainDocDate('[Date]')).toBe('');
  });
});

describe('nocEvidence', () => {
  const cases = [
    [{ ownershipType: 'subsidiary', companyType: 'foreign' }, 'foreign', ['subsidiary', 'foreign'], 2],
    [{ ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'name_only' }, 'indian-name-only', ['subsidiary', 'indian', 'name-only'], 3],
    [{ ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'investing' }, 'indian-investing', ['subsidiary', 'indian', 'investing'], 3],
    [{ ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: null }, 'indian-not-chosen', ['subsidiary', 'indian', 'not-chosen'], 3],
    [{ ownershipType: 'independent', companyType: 'domestic' }, 'standalone', ['standalone'], 1],
  ] as const;

  it.each(cases)('lights the path resolveNocVariant picks (%o)', (project, outcome, path, n) => {
    const e = nocEvidence(project);
    expect(e.outcome).toBe(outcome);
    expect(e.path).toEqual(path);
    expect(e.rows).toHaveLength(n);
    expect(e.variant).toBe(resolveNocVariant(project));
    expect(e.rows[0]!.asked).toBe('Project setup · Ownership type');
  });

  it('marks an unchosen parent role as missing, not as no NOC', () => {
    const e = nocEvidence({ ownershipType: 'subsidiary', companyType: 'domestic' });
    expect(e.rows.at(-1)).toMatchObject({ asked: 'Project setup · Parent’s role', answer: 'Not chosen yet', chose: 'No NOC yet', missing: true });
  });
});
