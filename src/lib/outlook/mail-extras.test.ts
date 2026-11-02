import { describe, expect, it } from 'vitest';
import {
  appendSignatureHtml,
  appendSignatureText,
  attachmentContentType,
  attachmentFileName,
  attachmentLimitError,
  base64ByteLength,
} from '@/lib/outlook/mail-extras';

const MB = 1024 * 1024;

describe('signature', () => {
  it('adds the signature after one blank line', () => {
    expect(appendSignatureText('Hi Rohan,\n\nThanks\n\n', 'Bharath\nSBC')).toBe('Hi Rohan,\n\nThanks\n\nBharath\nSBC');
    expect(appendSignatureText('Body', '  ')).toBe('Body');
    expect(appendSignatureText('', 'Sig')).toBe('Sig');
  });

  it('escapes the signature into HTML before the closing body tag', () => {
    expect(appendSignatureHtml('<html><body><p>Hi</p></body></html>', 'A & B\n<x>')).toBe(
      '<html><body><p>Hi</p><p style="margin:16px 0 0">A &amp; B<br />&lt;x&gt;</p></body></html>',
    );
    expect(appendSignatureHtml('<p>Hi</p>', 'S')).toBe('<p>Hi</p><p style="margin:16px 0 0">S</p>');
    expect(appendSignatureHtml('<p>Hi</p>', null)).toBe('<p>Hi</p>');
  });
});

describe('attachments', () => {
  it('measures base64 without decoding', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 100]) {
      const b64 = Buffer.alloc(n, 7).toString('base64');
      expect(base64ByteLength(b64)).toBe(n);
    }
  });

  it('refuses a file over 3 MB and a total over 10 MB', () => {
    expect(attachmentLimitError([{ name: 'a.pdf', size: 3 * MB }])).toBeNull();
    expect(attachmentLimitError([{ name: 'a.pdf', size: 3 * MB + 1 }])).toContain('a.pdf is over 3 MB');
    expect(
      attachmentLimitError([
        { name: 'a', size: 3 * MB },
        { name: 'b', size: 3 * MB },
        { name: 'c', size: 3 * MB },
        { name: 'd', size: MB + 1 },
      ]),
    ).toBe('Attachments are over 10 MB in all');
  });

  it('cleans content types and names', () => {
    expect(attachmentContentType('Application/PDF')).toBe('application/pdf');
    expect(attachmentContentType('text/html; charset=utf-8')).toBe('application/octet-stream');
    expect(attachmentContentType(undefined)).toBe('application/octet-stream');
    expect(attachmentFileName('C:\\tmp\\PAN\u0000.pdf')).toBe('PAN.pdf');
    expect(attachmentFileName('')).toBe('attachment');
  });
});
