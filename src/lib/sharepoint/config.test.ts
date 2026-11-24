import { describe, expect, it } from 'vitest';
import { sharepointConfig } from './config';

describe('sharepointConfig', () => {
  it('reads the site and the clients folder', () => {
    expect(sharepointConfig({ SHAREPOINT_SITE_URL: 'https://sbc.sharepoint.com/sites/Work/', SHAREPOINT_CLIENTS_PATH: '/Shared Documents/Clients/' })).toEqual({
      hostname: 'sbc.sharepoint.com',
      sitePath: '/sites/Work',
      clientsPath: 'Shared Documents/Clients',
    });
    expect(sharepointConfig({ SHAREPOINT_SITE_URL: 'https://sbc.sharepoint.com' })).toEqual({ hostname: 'sbc.sharepoint.com', sitePath: '', clientsPath: 'Clients' });
  });

  it('is off without a SharePoint https URL, and refuses a path that climbs out', () => {
    expect(sharepointConfig({})).toBeNull();
    expect(sharepointConfig({ SHAREPOINT_SITE_URL: 'http://sbc.sharepoint.com' })).toBeNull();
    expect(sharepointConfig({ SHAREPOINT_SITE_URL: 'https://evil.example.com/sites/x' })).toBeNull();
    expect(sharepointConfig({ SHAREPOINT_SITE_URL: 'https://sbc.sharepoint.com', SHAREPOINT_CLIENTS_PATH: '../x' })).toBeNull();
  });
});
