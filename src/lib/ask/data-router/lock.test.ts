import { describe, expect, it } from 'vitest';
import { companiesNamed, documentMatches, lockEngagement } from './lock';

const acme = { id: 'a', slug: 'acme-robotics', companyName: 'Acme Robotics Private Limited' };
const acmeFoods = { id: 'b', slug: 'acme-foods', companyName: 'Acme Foods LLP' };
const kestrel = { id: 'c', slug: 'kestrel', companyName: 'Kestrel Robotics Pvt Ltd' };
const engagements = [acme, acmeFoods, kestrel];

describe('lockEngagement', () => {
  it('locks to the one company a message names', () => {
    expect(lockEngagement({ message: 'Add this as director 2 for Kestrel', engagements })).toEqual({ kind: 'locked', engagement: kestrel });
    expect(lockEngagement({ message: 'file for acme robotics', engagements })).toEqual({ kind: 'locked', engagement: acme });
  });

  it('asks when two companies match', () => {
    const lock = lockEngagement({ message: 'Add this as director 2 for Acme', engagements });
    expect(lock).toEqual({ kind: 'choose', options: [acme, acmeFoods] });
  });

  it('never falls back to the page when the message names a company out of reach', () => {
    const lock = lockEngagement({ message: 'Add this for Zeta Industries', pagePath: '/app/intern/projects/kestrel', engagements });
    expect(lock).toEqual({ kind: 'unknown', mentioned: 'Zeta Industries' });
  });

  it('uses the page, then the only project, then asks', () => {
    expect(lockEngagement({ message: 'Add this as director 2', pagePath: '/app/intern/projects/kestrel/step/pre-15', engagements })).toEqual({ kind: 'locked', engagement: kestrel });
    expect(lockEngagement({ message: 'Add this', engagements: [kestrel] })).toEqual({ kind: 'locked', engagement: kestrel });
    expect(lockEngagement({ message: 'Add this', engagements })).toEqual({ kind: 'unknown', mentioned: null });
  });

  it('does not let one shared word move a run off the client on screen', () => {
    const page = '/app/intern/projects/kestrel';
    const reddy = { id: 'r', slug: 'reddy', companyName: 'Reddy Exports Pvt Ltd' };
    const list = [kestrel, reddy];
    expect(lockEngagement({ message: "Mr Reddy's PAN is on the form", pagePath: page, engagements: list })).toEqual({ kind: 'choose', options: [kestrel, reddy] });
    expect(lockEngagement({ message: 'File this for Reddy Exports', pagePath: page, engagements: list })).toEqual({ kind: 'locked', engagement: reddy });
    expect(lockEngagement({ message: 'File this for Kestrel', pagePath: page, engagements: list })).toEqual({ kind: 'locked', engagement: kestrel });
  });

  it('asks, with no project on screen, when one shared word is all that names a client', () => {
    const hyderabad = { id: 'h', slug: 'hyderabad-foods', companyName: 'Hyderabad Foods Pvt Ltd' };
    const list = [kestrel, hyderabad];
    expect(lockEngagement({ message: 'Ask the client for the Hyderabad office lease', engagements: list })).toEqual({ kind: 'choose', options: [hyderabad] });
    expect(lockEngagement({ message: 'Ask the client for the Hyderabad office lease', pendingEngagementId: 'h', engagements: list })).toEqual({ kind: 'locked', engagement: hyderabad });
    expect(lockEngagement({ message: 'Ask Hyderabad Foods for the office lease', engagements: list })).toEqual({ kind: 'locked', engagement: hyderabad });
  });

  it('never locks to a company outside the scoped list it is given', () => {
    expect(lockEngagement({ message: 'Add this for Zeta', pagePath: '/app/intern/projects/zeta', engagements: [] })).toEqual({ kind: 'unknown', mentioned: 'Zeta' });
    expect(lockEngagement({ message: 'Add this', pagePath: '/app/intern/projects/zeta', engagements: [] })).toEqual({ kind: 'unknown', mentioned: null });
  });
});

describe('companiesNamed', () => {
  it('in a client\'s run, treats only a company-like name as pointing elsewhere', () => {
    const own = [engagements[0]!];
    expect(lockEngagement({ message: 'This is for Asha Rao', engagements: own, ownCompany: true }).kind).toBe('locked');
    expect(lockEngagement({ message: 'File it for Zeta Industries Pvt Ltd', engagements: own, ownCompany: true })).toEqual({ kind: 'unknown', mentioned: 'Zeta Industries Pvt Ltd' });
    expect(lockEngagement({ message: 'This is for Asha Rao', engagements: own }).kind).toBe('unknown');
  });

  it('does not count a name that sits inside a longer one', () => {
    const foods = { id: 'f', slug: 'f', companyName: 'Sunrise Foods LLP' };
    const exports = { id: 'x', slug: 'x', companyName: 'Sunrise Foods Exports Pvt Ltd' };
    expect(companiesNamed('Sunrise Foods Exports', [foods, exports])).toEqual([exports]);
    expect(companiesNamed('Sunrise Foods', [foods, exports])).toEqual([foods]);
    expect(companiesNamed('Sunrise Foods and Sunrise Foods Exports', [foods, exports])).toEqual([foods, exports]);
  });

  it('prefers the whole name over a first word', () => {
    expect(companiesNamed('Acme Foods', engagements)).toEqual([acmeFoods]);
  });
});

describe('documentMatches', () => {
  it('accepts the same company in other words and refuses another', () => {
    expect(documentMatches('ACME ROBOTICS PVT. LTD.', [acme.companyName])).toBe(true);
    expect(documentMatches('Zeta Industries Limited', [acme.companyName])).toBe(false);
    expect(documentMatches('Solstice Energy Private Limited', [acme.companyName, 'Solstice Energy'])).toBe(true);
  });
});
