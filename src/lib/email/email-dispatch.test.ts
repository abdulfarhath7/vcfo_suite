import { describe, expect, it } from 'vitest';
import { emailDispatchToastId } from './email-dispatch';

describe('emailDispatchToastId', () => {
  it('is stable for retries of the same send on a step', () => {
    const draft = {
      kind: 'email.sent',
      title: 'pexpo Inc: manager approval requested on “Name Approval”',
    };
    const meta = { itemId: 'mca-name-approval', engagementId: 'pexpo-inc' };
    expect(emailDispatchToastId(draft, meta)).toBe(emailDispatchToastId(draft, meta));
    expect(emailDispatchToastId(draft, meta)).toContain('mca-name-approval');
    expect(emailDispatchToastId(draft, meta)).not.toBe('notification-undo');
  });

  it('differs across steps so two sends can show at once', () => {
    const draft = { kind: 'email.sent', title: 'Email sent' };
    expect(emailDispatchToastId(draft, { itemId: 'pre-1' })).not.toBe(
      emailDispatchToastId(draft, { itemId: 'pre-5' }),
    );
  });
});
