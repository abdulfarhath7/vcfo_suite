import { describe, expect, it } from 'vitest';
import { grantedScopes, hasFileScope } from './oauth';

describe('Graph scopes', () => {
  it('reads the scope names Microsoft granted, without the Graph prefix', () => {
    expect(grantedScopes('https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Files.Read.All User.Read')).toEqual(['Mail.Send', 'Files.Read.All', 'User.Read']);
    expect(grantedScopes(null)).toEqual([]);
  });

  it('knows a connection made before SharePoint reading cannot read files', () => {
    expect(hasFileScope(null)).toBe(false);
    expect(hasFileScope('Mail.Send User.Read Calendars.ReadWrite')).toBe(false);
    expect(hasFileScope('https://graph.microsoft.com/Files.Read.All Mail.Send')).toBe(true);
  });
});
