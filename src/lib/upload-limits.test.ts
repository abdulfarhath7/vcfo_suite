import { describe, expect, it } from 'vitest';
import {
  ALL_DOCUMENT_MIME_TYPES,
  ENGAGEMENT_DOCUMENTS_BUCKET_MIME_TYPES,
  EXTENSION_TO_MIME,
  KNOWLEDGE_BANK_BUCKET_MIME_TYPES,
  MILESTONE_BUCKET_MIME_TYPES,
  resolveUploadContentType,
  resolveUploadExtension,
  storageUploadErrorMessage,
  validateUploadFileType,
  KNOWLEDGE_BANK_EXTENSIONS,
  KNOWLEDGE_BANK_MIME_TYPES,
  MILESTONE_DOCUMENT_EXTENSIONS,
  MILESTONE_DOCUMENT_MIME_TYPES,
  SIGNED_BOARD_RESOLUTION_EXTENSIONS,
  SIGNED_BOARD_RESOLUTION_MIME_TYPES,
} from '@/lib/upload-limits';
import { validateKnowledgeBankUploadFile } from '@/lib/knowledge-bank-storage';
import { validateMilestoneUploadFile } from '@/lib/milestone-document-storage';
import { validateSignedBoardResolutionFile } from '@/lib/board-resolution-storage';

function mockFile(name: string, type: string, size = 1024): File {
  return { name, type, size } as File;
}

describe('upload MIME allowlists', () => {
  it('includes docx and legacy Office MIME types in bucket lists', () => {
    expect(KNOWLEDGE_BANK_BUCKET_MIME_TYPES).toContain(EXTENSION_TO_MIME.docx);
    expect(KNOWLEDGE_BANK_BUCKET_MIME_TYPES).toContain(EXTENSION_TO_MIME.doc);
    expect(KNOWLEDGE_BANK_BUCKET_MIME_TYPES).toContain(EXTENSION_TO_MIME.xlsx);
    expect(KNOWLEDGE_BANK_BUCKET_MIME_TYPES).toContain(EXTENSION_TO_MIME.pptx);
    expect(MILESTONE_BUCKET_MIME_TYPES).toContain(EXTENSION_TO_MIME.docx);
    expect(MILESTONE_BUCKET_MIME_TYPES).toContain(EXTENSION_TO_MIME.doc);
    expect(ENGAGEMENT_DOCUMENTS_BUCKET_MIME_TYPES).toContain(EXTENSION_TO_MIME.docx);
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

describe('storageUploadErrorMessage', () => {
  it('includes bucket and contentType in the message', () => {
    const msg = storageUploadErrorMessage(
      'milestone-documents',
      EXTENSION_TO_MIME.docx,
      'mime type application/vnd.openxmlformats-officedocument.wordprocessingml.document is not supported',
    );
    expect(msg).toContain('[bucket=milestone-documents');
    expect(msg).toContain(`contentType=${EXTENSION_TO_MIME.docx}`);
    expect(msg).toContain('storage_document_mime_types migration');
  });

  it('hints to apply knowledge_bank migration when bucket is missing', () => {
    const msg = storageUploadErrorMessage(
      'knowledge-bank',
      EXTENSION_TO_MIME.pdf,
      'Bucket not found',
    );
    expect(msg).toContain('knowledge_bank Supabase migration');
    expect(msg).toContain('knowledge-bank');
  });
});
