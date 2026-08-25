import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeBankTree,
  canDeleteKnowledgeBank,
  canInsertKnowledgeBank,
  canNestKnowledgeBankFolder,
  canReadKnowledgeBank,
  isKnowledgeBankFolderEmpty,
  knowledgeBankChildFolders,
  knowledgeBankFilesInFolder,
  knowledgeBankFolderAncestors,
  knowledgeBankFolderDepth,
  knowledgeBankFolderPath,
  knowledgeBankSiblingNameTaken,
  normalizeKnowledgeBankFolderName,
  wouldCreateKnowledgeBankCycle,
  type KnowledgeBankFolderRecord,
} from '@/lib/knowledge-bank-folders';

function folder(
  id: string,
  name: string,
  parentId: string | null = null,
): KnowledgeBankFolderRecord {
  return {
    id,
    parentId,
    name,
    createdBy: 'user-1',
    createdAt: '2026-08-24T00:00:00.000Z',
  };
}

const nested = [
  folder('policies', 'Policies'),
  folder('gst', 'GST', 'policies'),
  folder('fy25', 'FY25', 'gst'),
];

describe('Knowledge Bank parent nesting', () => {
  it('builds a tree with folders nested inside folders', () => {
    const tree = buildKnowledgeBankTree(nested);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe('Policies');
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.name).toBe('GST');
    expect(tree[0]?.children[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.children[0]?.name).toBe('FY25');
  });

  it('walks ancestors root → leaf and formats folderPath for search', () => {
    expect(knowledgeBankFolderAncestors('fy25', nested).map((row) => row.id)).toEqual([
      'policies',
      'gst',
      'fy25',
    ]);
    expect(knowledgeBankFolderPath(null, nested)).toBe('');
    expect(knowledgeBankFolderPath('policies', nested)).toBe('Policies');
    expect(knowledgeBankFolderPath('fy25', nested)).toBe('Policies / GST / FY25');
    expect(knowledgeBankFolderDepth('fy25', nested)).toBe(3);
  });

  it('lists children of the current folder and files in that folder', () => {
    expect(knowledgeBankChildFolders('policies', nested).map((row) => row.id)).toEqual(['gst']);
    expect(knowledgeBankChildFolders(null, nested).map((row) => row.id)).toEqual(['policies']);
    const files = [
      { id: 'root-file', folderId: null },
      { id: 'gst-file', folderId: 'gst' },
    ];
    expect(knowledgeBankFilesInFolder('gst', files).map((row) => row.id)).toEqual(['gst-file']);
    expect(knowledgeBankFilesInFolder(null, files).map((row) => row.id)).toEqual(['root-file']);
  });

  it('allows a nested create under a parent and refuses a cycle', () => {
    expect(canNestKnowledgeBankFolder('fy25', nested)).toBe(true);
    expect(wouldCreateKnowledgeBankCycle('policies', 'fy25', nested)).toBe(true);
    expect(wouldCreateKnowledgeBankCycle('fy25', 'policies', nested)).toBe(false);
    expect(wouldCreateKnowledgeBankCycle('gst', null, nested)).toBe(false);
  });

  it('treats a folder with nested children or files as non-empty', () => {
    expect(isKnowledgeBankFolderEmpty('fy25', nested, [])).toBe(true);
    expect(isKnowledgeBankFolderEmpty('gst', nested, [])).toBe(false);
    expect(
      isKnowledgeBankFolderEmpty('fy25', nested, [{ id: 'f1', folderId: 'fy25' }]),
    ).toBe(false);
  });

  it('rejects duplicate sibling names in the same parent', () => {
    expect(knowledgeBankSiblingNameTaken('gst', 'policies', nested)).toBe(true);
    expect(knowledgeBankSiblingNameTaken('GST', 'policies', nested)).toBe(true);
    expect(knowledgeBankSiblingNameTaken('GST', null, nested)).toBe(false);
    expect(knowledgeBankSiblingNameTaken('Other', 'policies', nested)).toBe(false);
  });
});

describe('Knowledge Bank intern cannot delete', () => {
  it('lets a project lead read and insert, but not delete files or folders', () => {
    expect(canReadKnowledgeBank('intern')).toBe(true);
    expect(canInsertKnowledgeBank('intern')).toBe(true);
    expect(canDeleteKnowledgeBank('intern')).toBe(false);
  });

  it('lets admin and manager delete; clients have no access', () => {
    expect(canDeleteKnowledgeBank('admin')).toBe(true);
    expect(canDeleteKnowledgeBank('manager')).toBe(true);
    expect(canReadKnowledgeBank('client')).toBe(false);
    expect(canInsertKnowledgeBank('client')).toBe(false);
    expect(canDeleteKnowledgeBank('client')).toBe(false);
  });
});

describe('normalizeKnowledgeBankFolderName', () => {
  it('trims and rejects slashes', () => {
    expect(normalizeKnowledgeBankFolderName('  GST  ')).toBe('GST');
    expect(normalizeKnowledgeBankFolderName('a / b')).toBeNull();
    expect(normalizeKnowledgeBankFolderName('')).toBeNull();
  });
});
