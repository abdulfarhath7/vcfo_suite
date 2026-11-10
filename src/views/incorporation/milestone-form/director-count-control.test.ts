import { describe, expect, it } from 'vitest';
import { withDirectorCount } from './director-count-control';

describe('withDirectorCount', () => {
  it('adds a director up to four', () => {
    expect(withDirectorCount({ directorCount: '2' }, 3).directorCount).toBe('3');
    expect(withDirectorCount({ directorCount: '4' }, 5).directorCount).toBe('4');
  });

  it('clears the answers of a removed director and never goes below two', () => {
    const next = withDirectorCount(
      { directorCount: '3', director3FirstName: 'Meera', director3LastName: 'Iyer', director2FirstName: 'Kiran' },
      2,
    );
    expect(next).toMatchObject({ directorCount: '2', director3FirstName: '', director3LastName: '', director2FirstName: 'Kiran' });
    expect(withDirectorCount({ directorCount: '2' }, 1).directorCount).toBe('2');
  });
});
