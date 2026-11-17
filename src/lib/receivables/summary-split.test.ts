import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/repositories/receivables', () => ({ finishSummarySend: vi.fn() }));
vi.mock('@/db/repositories/outlook-connections', () => ({ sendMailViaOutlook: vi.fn() }));

import { checkSummaryEmails } from './summary-send';
import type { Partner } from './model';

const partner = (slug: string, email: string): Partner => ({ id: `00000000-0000-4000-8000-00000000000${slug.length}`, slug, name: slug, email, active: true });
const pranay = partner('pranay', 'pranay@sbcllp.in');
const jey = partner('jey', 'jeyansh@sbcllp.in');
const partners = [pranay, jey];
const to = (email: string) => [{ name: '', email }];

describe('checkSummaryEmails', () => {
  it('sends one email per person: each partner alone, a leader with the whole sheet', () => {
    const r = checkSummaryEmails(
      [
        { kind: 'partner', partnerId: pranay.id, to: to('Pranay@sbcllp.in'), cc: [], subject: 's', html: 'pranay only' },
        { kind: 'partner', partnerId: jey.id, to: to('jeyansh@sbcllp.in'), cc: to('ops@sbcllp.in'), subject: 's', html: 'jey only' },
        { kind: 'full', to: to('ceo@sbcllp.in'), cc: [], subject: 's', html: 'all' },
      ],
      partners,
    );
    expect(r.ok).toBe(true);
    if (r.ok === true) expect(r.mails.map((m) => [m.to[0], m.html])).toEqual([['Pranay@sbcllp.in', 'pranay only'], ['jeyansh@sbcllp.in', 'jey only'], ['ceo@sbcllp.in', 'all']]);
  });

  it('refuses a partner email sent to someone else, or a partner on another email', () => {
    expect(checkSummaryEmails([{ kind: 'partner', partnerId: pranay.id, to: to('jeyansh@sbcllp.in'), cc: [], subject: 's', html: 'x' }], partners)).toEqual({ ok: false, error: 'partner_to' });
    expect(checkSummaryEmails([{ kind: 'partner', partnerId: pranay.id, to: to('pranay@sbcllp.in'), cc: to('jeyansh@sbcllp.in'), subject: 's', html: 'x' }], partners)).toEqual({ ok: false, error: 'partner_elsewhere' });
    expect(checkSummaryEmails([{ kind: 'full', to: to('ceo@sbcllp.in'), cc: to('pranay@sbcllp.in'), subject: 's', html: 'x' }], partners)).toEqual({ ok: false, error: 'partner_elsewhere' });
    expect(checkSummaryEmails([{ kind: 'full', to: to('pranay@sbcllp.in'), cc: [], subject: 's', html: 'x' }], partners)).toEqual({ ok: false, error: 'partner_elsewhere' });
  });
});
