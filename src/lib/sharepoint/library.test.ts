import { describe, expect, it } from 'vitest';
import { libraryCandidates } from './library';

const site = {
  defaultId: 'docs',
  drives: [
    { id: 'docs', name: 'Documents', webUrl: 'https://x.sharepoint.com/sites/s/Shared%20Documents' },
    { id: 'sf', name: 'SteadFast', webUrl: 'https://x.sharepoint.com/sites/s/SteadFast' },
  ],
};

describe('libraryCandidates', () => {
  it('tries the library the path names first, by display name or URL name, then the default library', () => {
    expect(libraryCandidates('SteadFast/Clients', site)).toEqual([
      { driveId: 'sf', path: 'Clients' },
      { driveId: 'docs', path: 'SteadFast/Clients' },
    ]);
    expect(libraryCandidates('Shared Documents/Clients', site)[0]).toEqual({ driveId: 'docs', path: 'Clients' });
  });

  it('uses only the default library when the path has one part or names no library', () => {
    expect(libraryCandidates('Clients', site)).toEqual([{ driveId: 'docs', path: 'Clients' }]);
    expect(libraryCandidates('Work/Clients', site)).toEqual([{ driveId: 'docs', path: 'Work/Clients' }]);
  });
});
