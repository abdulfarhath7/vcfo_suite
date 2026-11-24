import { describe, expect, it } from 'vitest';
import { matchClientFolder } from './match';

const folders = [
  { id: '1', name: 'Kestrel Analytics' },
  { id: '2', name: 'Solstice Foods Pvt Ltd' },
  { id: '3', name: 'Routeware' },
  { id: '4', name: 'Routeware Logistics' },
  { id: '5', name: 'Arc' },
];

describe('matchClientFolder', () => {
  it('matches without company suffixes, case or punctuation', () => {
    expect(matchClientFolder('Kestrel Analytics Private Limited', folders)).toEqual({ kind: 'one', folder: folders[0] });
    expect(matchClientFolder('SOLSTICE FOODS PRIVATE LIMITED', folders)).toEqual({ kind: 'one', folder: folders[1] });
  });

  it('prefers the exact core name over a longer folder that contains it', () => {
    expect(matchClientFolder('Routeware Pvt. Ltd.', folders)).toEqual({ kind: 'one', folder: folders[2] });
  });

  it('takes a single partial match and asks when there are several', () => {
    expect(matchClientFolder('Kestrel', folders)).toEqual({ kind: 'one', folder: folders[0] });
    expect(matchClientFolder('Ware', [{ id: 'a', name: 'Ware One' }, { id: 'b', name: 'Ware Two' }])).toEqual({ kind: 'many', options: [{ id: 'a', name: 'Ware One' }, { id: 'b', name: 'Ware Two' }] });
  });

  it('never guesses from a short name or an unrelated folder', () => {
    expect(matchClientFolder('Arcadia Ventures', folders)).toEqual({ kind: 'none' });
    expect(matchClientFolder('Trial Private Ltd', folders)).toEqual({ kind: 'none' });
  });
});
