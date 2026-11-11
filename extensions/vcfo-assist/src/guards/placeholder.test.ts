import { describe, expect, it } from 'vitest';
import { placeholderReason } from './placeholder';

// G16 (ICAI DC/1891/2024): no dummy value is ever typed, whatever the recipe says.
describe('no placeholder values (G16)', () => {
  const firm = { emails: ['desk@sbcfirm.in'], phones: ['9876501234'] };

  it.each(['', '   ', '-', '--', '.', 'N/A', 'na', 'NA.', 'n.a', 'Nil', 'none', 'null', 'TBD', 'test', 'Dummy', 'xxx', 'XXXX', 'x x x', 'abc', 'sample'])(
    'refuses %j',
    (v) => {
      expect(placeholderReason(v)).not.toBeNull();
    },
  );

  it.each(['0000000000', '9999999999', '1234567890', '0123456789', '9876543210', '+91 99999 99999', '111111', '000000'])('refuses the dummy number %s', (v) => {
    expect(placeholderReason(v)).toMatchObject({ reason: 'placeholder' });
  });

  it.each(['test@test.com', 'dummy@gmail.com', 'na@na.com', 'someone@example.com', 'abc@xyz.com'])('refuses the placeholder email %s', (v) => {
    expect(placeholderReason(v)).toMatchObject({ reason: 'placeholder' });
  });

  it("refuses the firm's own phone and email in a client's field", () => {
    expect(placeholderReason('Desk@SBCFirm.in', firm)).toMatchObject({ reason: 'firm_contact' });
    expect(placeholderReason('+91 98765 01234', firm)).toMatchObject({ reason: 'firm_contact' });
    expect(placeholderReason('098765-01234', firm)).toMatchObject({ reason: 'firm_contact' });
  });

  it.each(['Sentinel Alpha Private Limited', 'Test Labs Private Limited', '9000000021', '09876543', '500081', '1000000', '100000', '5000', '62', 'office@sentinel.test', 'NEW', 'Hyderabad'])(
    'lets the real value %s through',
    (v) => {
      expect(placeholderReason(v, firm)).toBeNull();
    },
  );

  it('leaves the missing case to the caller', () => {
    expect(placeholderReason(undefined)).toBeNull();
    expect(placeholderReason(null)).toBeNull();
  });
});
