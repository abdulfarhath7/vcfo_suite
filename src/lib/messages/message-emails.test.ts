import { describe, expect, it } from 'vitest';
import { buildClientMessageEmail, buildReminderEmail, buildStaffReplyEmail, composeStepOpenedEmail } from '@/lib/messages/message-emails';

describe('message emails', () => {
  it('escapes the client’s words and links the lead to the inbox', () => {
    const copy = buildClientMessageEmail({
      companyName: 'Acme',
      senderName: 'Ravi',
      body: 'Is <b>this</b> fine?\n\nThanks',
      inboxHref: '/app/lead/today',
    });
    expect(copy.subject).toContain('Acme: message from Ravi');
    expect(copy.html).toContain('Is &lt;b&gt;this&lt;/b&gt; fine?');
    expect(copy.html).not.toContain('<b>this</b>');
    expect(copy.text).toContain('/app/lead/today');
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

describe('DR-03 step-opened email', () => {
  it('asks the client to fill each proposed director, names the project and links the step', () => {
    const email = composeStepOpenedEmail({
      companyName: 'Ember Technologies Private Limited',
      itemTitle: 'Proposed directors',
      senderName: 'Asha',
      stepHref: '/app/client/incorporation/step/proposed-directors',
      to: ['client@example.com'],
    });
    expect(email.to).toEqual(['client@example.com']);
    expect(email.subject).toBe('Ember Technologies Private Limited: Proposed directors is open');
    expect(email.message).toContain('Proposed directors for Ember Technologies Private Limited is open.');
    expect(email.message).toContain('Please fill the details of each proposed director.');
    expect(email.text(email.message)).toContain('/app/client/incorporation/step/proposed-directors');
    expect(email.html('Edited words')).toContain('Edited words');
    expect(email.html('Edited words')).toContain('Open the step');
  });

  it("adds the Lead's note under the message", () => {
    const email = composeStepOpenedEmail({ companyName: 'Acme', itemTitle: 'Proposed directors', senderName: 'Asha', note: 'Two directors, please.', stepHref: '/x', to: [] });
    expect(email.message).toContain('Asha: Two directors, please.');
  });
});
