import { describe, expect, it } from 'vitest';
import {
  isEmailAddress,
  resolveTypedRecipients,
  splitTypedRecipients,
} from './recipient-input';

const people = [
  { userId: 'u1', email: 'Anita@Firm.in' },
  { userId: 'u2', email: 'raj@client.com' },
];

describe('isEmailAddress', () => {
  it('accepts ordinary addresses', () => {
    expect(isEmailAddress('ca.office@gmail.com')).toBe(true);
    expect(isEmailAddress('  first.last+tag@sub.example.co.in ')).toBe(true);
  });
  it('rejects partial input', () => {
    for (const bad of ['', 'anita', 'anita@', '@firm.in', 'anita@firm', 'a b@c.in', 'a@b.c']) {
      expect(isEmailAddress(bad)).toBe(false);
    }
  });
});

describe('splitTypedRecipients', () => {
  it('splits on commas, semicolons and whitespace and unwraps display names', () => {
    expect(splitTypedRecipients('Anita <anita@x.in>, raj@y.com;  bad\n c@d.io')).toEqual([
      'anita@x.in',
      'raj@y.com',
      'bad',
      'c@d.io',
    ]);
  });
});

describe('resolveTypedRecipients', () => {
  it('routes a directory address to the person, keeps outsiders as emails, flags junk', () => {
    expect(resolveTypedRecipients(people, 'ANITA@firm.in, ca@outside.com bad raj@client.com')).toEqual({
      personIds: ['u1', 'u2'],
      emails: ['ca@outside.com'],
      invalid: ['bad'],
    });
  });
  it('lower-cases and de-duplicates outside addresses', () => {
    expect(resolveTypedRecipients(people, 'CA@Outside.com ca@outside.com').emails).toEqual([
      'ca@outside.com',
    ]);
  });
});
