import { describe, expect, it } from 'vitest';
import { draftView, EmailStepSchema, messageHtml, withEdits, type ComposedEmail } from './email-edits';

const composed: ComposedEmail = {
  to: ['a@client.com'],
  cc: ['lead@firm.com', 'a@client.com'],
  subject: 'Template subject',
  message: 'Template words.',
  html: (m) => `<main>${messageHtml(m)}<a>Open</a></main>`,
  text: (m) => `${m}\nOpen: https://x`,
  attachments: [{ filename: 'notice.docx', content: new Uint8Array([1]) }],
  purpose: 'test',
  fixed: 'the Open button',
};

describe('GL-07 email drafts and edits', () => {
  it('shows the draft without duplicate copies', () => {
    expect(draftView(composed)).toEqual({ to: ['a@client.com'], cc: ['lead@firm.com'], subject: 'Template subject', message: 'Template words.', attachments: ['notice.docx'], fixed: 'the Open button' });
  });

  it('sends the changed text, not the template text, and keeps the fixed parts', () => {
    const mail = withEdits(composed, {
      to: ['B@Client.com'],
      cc: ['b@client.com', 'x@firm.com'],
      subject: 'My subject',
      message: 'My own words.\n\nSecond <para>.',
      dropAttachments: ['notice.docx'],
      addAttachments: [{ filename: 'extra.pdf', contentBase64: Buffer.from('pdf').toString('base64'), contentType: 'application/pdf' }],
    });
    expect(mail.to).toEqual(['b@client.com']);
    expect(mail.cc).toEqual(['x@firm.com']);
    expect(mail.subject).toBe('My subject');
    expect(mail.html).toContain('My own words.');
    expect(mail.html).toContain('Second &lt;para&gt;.');
    expect(mail.html).not.toContain('Template words');
    expect(mail.html).toContain('<a>Open</a>');
    expect(mail.text).toBe('My own words.\n\nSecond <para>.\nOpen: https://x');
    expect(mail.attachments?.map((a) => a.filename)).toEqual(['extra.pdf']);
  });

  it('refuses a send with no recipient or a bad address', () => {
    expect(EmailStepSchema.safeParse({ email: { to: [], cc: [], subject: 'x', message: '' } }).success).toBe(false);
    expect(EmailStepSchema.safeParse({ email: { to: ['not-an-email'], subject: 'x', message: '' } }).success).toBe(false);
    expect(EmailStepSchema.safeParse({ preview: true }).success).toBe(true);
  });
});
