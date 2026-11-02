import { describe, expect, it } from 'vitest';
import { settingsHrefFromProfile } from './profile-redirect';

describe('old Profile address → console Settings', () => {
  it('maps the old tabs to the console sections', () => {
    expect(settingsHrefFromProfile('/app/manager', 'security')).toBe('/app/manager/settings?section=security');
    expect(settingsHrefFromProfile('/app/intern', 'email')).toBe('/app/intern/settings?section=outlook');
    expect(settingsHrefFromProfile('/app/manager', 'Appearance')).toBe('/app/manager/settings?section=look');
    expect(settingsHrefFromProfile('/app/manager', ['profile', 'security'])).toBe('/app/manager/settings?section=profile');
  });

  it('lands on Settings itself when there is no tab or no matching section', () => {
    expect(settingsHrefFromProfile('/app/manager', undefined)).toBe('/app/manager/settings');
    expect(settingsHrefFromProfile('/app/intern', 'notify')).toBe('/app/intern/settings');
    expect(settingsHrefFromProfile('/app/intern', 'settings')).toBe('/app/intern/settings');
  });
});
