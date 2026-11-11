import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist/checklist-responses';
import { isRepeatField, type RepeatField } from '@/lib/checklist/checklist-repeat';
import { answersTable, entriesTable, PROJECT_ZIP_FOLDERS } from './project-zip-tables';

describe('PR-02 project ZIP contents', () => {
  it('has one folder for each kind of item', () => {
    expect(Object.values(PROJECT_ZIP_FOLDERS)).toEqual([
      '1 Answers', '2 Directors', '3 Subscribers', '4 Generated documents', '5 Uploaded documents', '6 Board resolution', '7 Audit log',
    ]);
  });

  it('lists every answered question with its step, section and readable answer', () => {
    const table = answersTable({
      'pre-13': { responses: { equityShares: 'yes', equityQuantity: '10000' } },
      'pre-15': { responses: { directors: 'e1', 'directors.e1.firstName': 'Asha', 'directors.e1.recentPhotographUrl': 'eng/directors.e1.recentPhotographUrl/123-photo.jpg' } },
    });
    expect(table.columns).toEqual(['Step', 'Section', 'Question', 'Answer']);
    expect(table.rows).toContainEqual(['Capital Structure', '3A(i) Equity share capital', 'Equity share capital', 'Yes']);
    expect(table.rows).toContainEqual(['Proposed Directors', '7 Particulars of directors', 'First Name · Director 1', 'Asha']);
    expect(table.rows).toContainEqual(expect.arrayContaining(['123-photo.jpg']));
  });

  it('puts one row per director or subscriber', () => {
    const group = CLIENT_RESPONSE_FIELDS['pre-16'].find(isRepeatField) as RepeatField;
    const table = entriesTable('Subscribers', group, { subscribers: 'a,b', 'subscribers.a.name': 'Parent Inc', 'subscribers.b.name': 'Asha Rao', 'subscribers.b.type': 'individual' });
    expect(table.rows).toHaveLength(2);
    expect(table.columns[0]).toBe('#');
    expect(table.rows[1]).toContain('Individual');
  });
});
