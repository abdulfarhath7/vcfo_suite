import { describe, expect, it } from 'vitest';
import { capturedDirectorSchema } from './capture';
import { normalizeDinResponse } from './normalize';

/**
 * The extension posts what it read on the MCA page. These tests hold the two promises the
 * capture makes: one shape reaches the page whichever source answered, and nothing a person
 * types into the portal (password, OTP, captcha) can ride along into the database.
 */
describe('capturedDirectorSchema', () => {
  const page = {
    din: '08123456',
    name: 'RAMESH KUMAR',
    din_status: 'Approved',
    approve_date: '12/04/2018',
    dir3_kyc: 'Not Done',
    association: [
      { cin: 'U74999TG2019PTC130001', com_name: 'KESTREL ROBOTICS PRIVATE LIMITED', designation: 'Director', appointment: '01/06/2019', entity_type: 'company' },
    ],
  };

  it('takes a portal capture and normalises it like the API answer', () => {
    const parsed = capturedDirectorSchema.parse(page);
    const data = normalizeDinResponse(parsed as Record<string, unknown>, '08123456');
    expect(data.name).toBe('RAMESH KUMAR');
    expect(data.approveDate).toBe('2018-04-12');
    expect(data.associations[0].companyName).toBe('KESTREL ROBOTICS PRIVATE LIMITED');
    expect(data.associations[0].appointmentDate).toBe('2019-06-01');
  });

  it('strips anything the page did not promise, credentials included', () => {
    const parsed = capturedDirectorSchema.parse({
      ...page,
      password: 'hunter2',
      otp: '483920',
      captcha: 'x7f2a',
      cookie: 'JSESSIONID=abc',
    }) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['approve_date', 'association', 'din', 'din_status', 'dir3_kyc', 'name']);
    expect(JSON.stringify(parsed)).not.toContain('hunter2');
    expect(JSON.stringify(parsed)).not.toContain('483920');
  });

  it('refuses a capture with no DIN, and caps a runaway association list', () => {
    expect(capturedDirectorSchema.safeParse({ name: 'A' }).success).toBe(false);
    const tooMany = { din: '08123456', association: Array.from({ length: 501 }, () => ({ cin: 'U1' })) };
    expect(capturedDirectorSchema.safeParse(tooMany).success).toBe(false);
  });
});
