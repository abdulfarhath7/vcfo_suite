import { describe, expect, it } from 'vitest';
import { memberText, parseMemberText } from './use-mail-groups';

describe('parseMemberText', () => {
  it('reads plain and named addresses split by commas, semicolons or lines', () => {
    expect(parseMemberText('A@x.in, Rohan Rao <rohan@client.in>; \n"Bank" <ops@bank.in>\na@x.in')).toEqual({
      members: [
        { email: 'a@x.in', name: null },
        { email: 'rohan@client.in', name: 'Rohan Rao' },
        { email: 'ops@bank.in', name: 'Bank' },
      ],
      invalid: [],
    });
  });

  it('returns the parts that are not addresses', () => {
    expect(parseMemberText('nope, ok@x.in').invalid).toEqual(['nope']);
  });

  it('round-trips through the edit text', () => {
    const members = [
      { email: 'rohan@client.in', name: 'Rohan' },
      { email: 'a@x.in', name: null },
    ];
    expect(parseMemberText(memberText(members)).members).toEqual(members);
  });
});
