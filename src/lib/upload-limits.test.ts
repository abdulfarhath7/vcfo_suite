import { describe, expect, it } from 'vitest';
import {
  ALL_DOCUMENT_MIME_TYPES,
  EXTENSION_TO_MIME,
  resolveUploadContentType,
  resolveUploadExtension,
  validateUploadFileType,
  KNOWLEDGE_BANK_EXTENSIONS,
  KNOWLEDGE_BANK_MIME_TYPES,
  MILESTONE_DOCUMENT_EXTENSIONS,
  SIGNED_BOARD_RESOLUTION_EXTENSIONS,
} from '@/lib/upload-limits';
import { validateKnowledgeBankUploadFile } from '@/lib/knowledge-bank-storage';
import { validateMilestoneUploadFile } from '@/lib/milestone-document-storage';
import { validateSignedBoardResolutionFile } from '@/lib/board-resolution-storage';

function mockFile(name: string, type: string, size = 1024): File {
  return { name, type, size } as File;
}

describe('upload MIME allowlists', () => {
  it('lists nine document MIME types', () => {
    expect(ALL_DOCUMENT_MIME_TYPES).toHaveLength(9);
  });

  it('accepts .docx by extension when browser sends application/octet-stream', () => {
    const file = mockFile('signed-resolution.docx', 'application/octet-stream');
    expect(resolveUploadExtension(file, SIGNED_BOARD_RESOLUTION_EXTENSIONS)).toBe('docx');
    expect(resolveUploadContentType(file, SIGNED_BOARD_RESOLUTION_EXTENSIONS)).toBe(
      EXTENSION_TO_MIME.docx,
    );
    expect(validateSignedBoardResolutionFile(file)).toBeNull();
  });

  it('accepts correct docx MIME type', () => {
    const file = mockFile('board-resolution.docx', EXTENSION_TO_MIME.docx);
    expect(validateSignedBoardResolutionFile(file)).toBeNull();
    expect(validateMilestoneUploadFile(file)).toBeNull();
    expect(validateKnowledgeBankUploadFile(file)).toBeNull();
  });

  it('accepts legacy .doc by extension with octet-stream', () => {
    const file = mockFile('legacy.doc', 'application/octet-stream');
    expect(resolveUploadExtension(file, MILESTONE_DOCUMENT_EXTENSIONS)).toBe('doc');
    expect(resolveUploadContentType(file, MILESTONE_DOCUMENT_EXTENSIONS)).toBe(
      EXTENSION_TO_MIME.doc,
    );
    expect(validateMilestoneUploadFile(file)).toBeNull();
    expect(validateKnowledgeBankUploadFile(file)).toBeNull();
  });

  it('accepts xlsx and pptx in knowledge bank', () => {
    const xlsx = mockFile('template.xlsx', EXTENSION_TO_MIME.xlsx);
    const pptx = mockFile('deck.pptx', 'application/octet-stream');
    expect(validateKnowledgeBankUploadFile(xlsx)).toBeNull();
    expect(validateKnowledgeBankUploadFile(pptx)).toBeNull();
    expect(validateMilestoneUploadFile(xlsx)).not.toBeNull();
  });

  it('rejects unsupported MIME when extension does not match', () => {
    const file = mockFile('notes.txt', 'application/zip');
    expect(
      validateUploadFileType(
        file,
        KNOWLEDGE_BANK_EXTENSIONS,
        KNOWLEDGE_BANK_MIME_TYPES,
        'unsupported',
      ),
    ).toBe('unsupported');
  });

  it('rejects unknown extensions', () => {
    const file = mockFile('archive.zip', 'application/zip');
    expect(validateSignedBoardResolutionFile(file)).not.toBeNull();
    expect(validateMilestoneUploadFile(file)).not.toBeNull();
    expect(validateKnowledgeBankUploadFile(file)).not.toBeNull();
  });
});

