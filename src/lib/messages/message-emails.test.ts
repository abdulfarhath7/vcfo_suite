import { describe, expect, it } from 'vitest';
import { buildClientMessageEmail, buildReminderEmail, buildStaffReplyEmail } from '@/lib/messages/message-emails';

describe('message emails', () => {
  it('escapes the client’s words and links the lead to the inbox', () => {
    const copy = buildClientMessageEmail({
      companyName: 'Acme',
      senderName: 'Ravi',
      body: 'Is <b>this</b> fine?\n\nThanks',
      inboxHref: '/app/intern/today',
    });
    expect(copy.subject).toContain('Acme: message from Ravi');
    expect(copy.html).toContain('Is &lt;b&gt;this&lt;/b&gt; fine?');
    expect(copy.html).not.toContain('<b>this</b>');
    expect(copy.text).toContain('/app/intern/today');
  });

  it('names the staff sender on a reply', () => {
    const copy = buildStaffReplyEmail({ companyName: 'Acme', senderName: 'Asha', body: 'Done', portalHref: '/app/client/messages' });
    expect(copy.subject).toBe('Acme: reply from Asha');
    expect(copy.text).toContain('/app/client/messages');
  });

  it('puts the item in the reminder subject and the note in the body', () => {
    const copy = buildReminderEmail({
      companyName: 'Acme',
      itemTitle: 'Upload PAN',
      senderName: 'Asha',
      note: 'Needed by Friday',
      portalHref: '/app/client/documents',
    });
    expect(copy.subject).toBe('Acme: reminder · Upload PAN');
    expect(copy.html).toContain('Needed by Friday');
    expect(copy.text).toContain('Asha: Needed by Friday');
  });
});
