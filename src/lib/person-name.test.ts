import { describe, expect, it } from 'vitest';
import {
  formatDisplayName,
  resolveDirectorDisplayName,
  resolvePre6DirectorDisplayName,
  resolveSignatoryDisplayName,
} from '@/lib/person-name';

describe('formatDisplayName', () => {
  it('joins first, middle, and last with spaces', () => {
    expect(formatDisplayName('Jane', 'Marie', 'Doe')).toBe('Jane Marie Doe');
    expect(formatDisplayName('Jane', '', 'Doe')).toBe('Jane Doe');
    expect(formatDisplayName('Jane', undefined, 'Doe')).toBe('Jane Doe');
  });
});

describe('resolveSignatoryDisplayName', () => {
  it('prefers split fields and falls back to legacy signatoryName', () => {
    expect(
      resolveSignatoryDisplayName({
        signatoryFirstName: 'Sam',
        signatoryLastName: 'Patel',
      }),
    ).toBe('Sam Patel');
    expect(resolveSignatoryDisplayName({ signatoryName: 'Legacy Name' })).toBe('Legacy Name');
  });
});

describe('resolveDirectorDisplayName', () => {
  it('prefers split fields and falls back to legacy directorName', () => {
    expect(
      resolveDirectorDisplayName(
        { director1FirstName: 'Alex', director1LastName: 'Director' },
        1,
      ),
    ).toBe('Alex Director');
    expect(resolveDirectorDisplayName({ director1Name: 'Legacy Director' }, 1)).toBe(
      'Legacy Director',
    );
  });
});

describe('resolvePre6DirectorDisplayName', () => {
  it('joins split name fields for each director kind', () => {
    expect(
      resolvePre6DirectorDisplayName(
        {
          nrDirectorFirstName: 'Justin',
          nrDirectorMiddleName: 'Cheng',
          nrDirectorLastName: 'Hsu',
        },
        'non-resident',
      ),
    ).toBe('Justin Cheng Hsu');
    expect(
      resolvePre6DirectorDisplayName(
        { residentDirectorFirstName: 'Priya', residentDirectorLastName: 'Sharma' },
        'resident',
      ),
    ).toBe('Priya Sharma');
  });

  it('falls back to legacy full-name fields', () => {
    expect(
      resolvePre6DirectorDisplayName({ nrDirectorFullName: 'Justin Cheng Hsu' }, 'non-resident'),
    ).toBe('Justin Cheng Hsu');
  });
});
