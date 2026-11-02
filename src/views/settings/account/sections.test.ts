import { describe, expect, it } from 'vitest';
import { sectionFromLocation } from './sections';

const STAFF = ['profile', 'security', 'notify', 'email', 'appearance', 'settings'];
const CLIENTISH = ['profile', 'security', 'notify', 'appearance'];

describe('sectionFromLocation', () => {
  it('reads the tab parameter and its prototype aliases', () => {
    expect(sectionFromLocation('?tab=security', '', 'tab', STAFF)).toBe('security');
    expect(sectionFromLocation('?tab=about', '', 'tab', STAFF)).toBe('profile');
    expect(sectionFromLocation('?tab=look', '', 'tab', STAFF)).toBe('appearance');
    expect(sectionFromLocation('?tab=settings', '', 'tab', STAFF)).toBe('settings');
  });

  it('ignores a section the role does not have', () => {
    expect(sectionFromLocation('?tab=settings', '', 'tab', CLIENTISH)).toBeNull();
    expect(sectionFromLocation('?outlook=connected', '', 'tab', CLIENTISH)).toBeNull();
  });

  it('opens Email on the Outlook connect return', () => {
    expect(sectionFromLocation('?outlook=connected', '', 'tab', STAFF)).toBe('email');
  });

  it('falls back to the hash, as the greeting card link uses', () => {
    expect(sectionFromLocation('', '#appearance', 'tab', STAFF)).toBe('appearance');
  });

  it('reads another parameter name inside super admin settings', () => {
    expect(sectionFromLocation('?tab=profile&section=notify', '', 'section', STAFF)).toBe('notify');
    expect(sectionFromLocation('?tab=profile', '#appearance', 'section', STAFF)).toBe('appearance');
  });
});
