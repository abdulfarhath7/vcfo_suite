import 'server-only';

/**
 * An email saved as a file: a `.eml` (any mail program) or an Outlook `.msg`. The reader takes its
 * headers and body as text and each attachment as a file of its own, so a PDF sent with the email is
 * read exactly as if it had been dropped. `postal-mime` parses `.eml` and `@kenjiuno/msgreader`
 * parses `.msg`; both are small and have no native parts.
 *
 * What an email says is data, like any document: nothing here follows it, it is only turned into
 * text and files.
 */

export interface EmailFile {
  fileName: string;
  data: Buffer;
}

export interface ParsedEmail {
  /** The headers that say what the email is, and its body as plain text. */
  text: string;
  attachments: EmailFile[];
}

export class EmailUnreadable extends Error {
  constructor(message = 'This email file could not be read.') {
    super(message);
    this.name = 'EmailUnreadable';
  }
}

/** At most this many attachments of one email are read; an email with more is unusual. */
export const EMAIL_MAX_ATTACHMENTS = 10;
const BODY_MAX_CHARS = 60_000;

export function isEmailName(fileName: string): boolean {
  return /\.(?:eml|msg)$/i.test(fileName);
}

/** Text out of an HTML body, when the email has no plain-text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * The email's headers as one plain sentence, then its body. The headers are not written as
 * "Subject: …" lines, so they never make a prose email look like labelled data to the reader.
 */
function headerText(fields: { subject?: string | null; from?: string | null; to?: string | null; date?: string | null }, body: string): string {
  const said = [
    'Email',
    fields.subject ? `"${fields.subject}"` : '',
    fields.from ? `from ${fields.from}` : '',
    fields.to ? `to ${fields.to}` : '',
    fields.date ? `sent ${fields.date}` : '',
  ].filter(Boolean);
  const head = said.length > 1 ? `${said.join(' ')}.` : '';
  return [head, body.trim()].filter(Boolean).join('\n\n').slice(0, BODY_MAX_CHARS).trim();
}

const toBuffer = (content: ArrayBuffer | Uint8Array | string): Buffer =>
  typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content instanceof ArrayBuffer ? new Uint8Array(content) : content);

async function parseEml(data: Buffer): Promise<ParsedEmail> {
  const { default: PostalMime } = await import('postal-mime');
  const mail = await PostalMime.parse(new Uint8Array(data), { attachmentEncoding: 'arraybuffer' });
  const address = (a?: { name?: string; address?: string } | null) => (a ? [a.name, a.address ? `<${a.address}>` : ''].filter(Boolean).join(' ') : null);
  const body = mail.text?.trim() ? mail.text : mail.html ? htmlToText(mail.html) : '';
  const attachments = (mail.attachments ?? [])
    .filter((a) => a.disposition !== 'inline' || Boolean(a.filename))
    .map((a, i) => ({ fileName: a.filename || `attachment-${i + 1}`, data: toBuffer(a.content) }));
  return {
    text: headerText({ subject: mail.subject, from: address(mail.from as { name?: string; address?: string } | undefined), to: (mail.to ?? []).map((t) => address(t as { name?: string; address?: string })).filter(Boolean).join(', '), date: mail.date ?? null }, body),
    attachments,
  };
}

async function parseMsg(data: Buffer): Promise<ParsedEmail> {
  const { default: MsgReader } = await import('@kenjiuno/msgreader');
  const reader = new MsgReader(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  const fields = reader.getFileData();
  if (fields.error) throw new EmailUnreadable();
  const body = fields.body?.trim() ? fields.body : fields.bodyHtml ? htmlToText(fields.bodyHtml) : '';
  const attachments: EmailFile[] = [];
  for (const attachment of fields.attachments ?? []) {
    // An email attached to the email is not opened again; its own attachments stay inside it.
    if (attachment.innerMsgContent) continue;
    try {
      const file = reader.getAttachment(attachment);
      if (file?.content?.length) attachments.push({ fileName: file.fileName || attachment.fileName || 'attachment', data: Buffer.from(file.content) });
    } catch {
      // One attachment that cannot be opened leaves the rest of the email readable.
    }
  }
  const from = [fields.senderName, fields.senderEmail ? `<${fields.senderEmail}>` : ''].filter(Boolean).join(' ');
  return { text: headerText({ subject: fields.subject ?? null, from: from || null }, body), attachments };
}

export async function parseEmail(file: EmailFile): Promise<ParsedEmail> {
  try {
    const parsed = /\.msg$/i.test(file.fileName) ? await parseMsg(file.data) : await parseEml(file.data);
    return { text: parsed.text, attachments: parsed.attachments.slice(0, EMAIL_MAX_ATTACHMENTS) };
  } catch (error) {
    if (error instanceof EmailUnreadable) throw error;
    throw new EmailUnreadable();
  }
}
