import { describe, expect, it } from 'vitest';
import { cityFromHeaders, deviceLabel } from './sign-in-device';

describe('cityFromHeaders (C-851)', () => {
  it('reads the CDN city headers', () => {
    expect(cityFromHeaders(new Headers({ 'cloudfront-viewer-city': 'Hyderabad' }))).toBe('Hyderabad');
    expect(cityFromHeaders(new Headers({ 'x-vercel-ip-city': 'S%C3%A3o%20Paulo' }))).toBe('São Paulo');
    expect(cityFromHeaders(new Headers({ 'cf-ipcity': 'New Delhi' }))).toBe('New Delhi');
  });
  it('is null without a geo header, and strips markup', () => {
    expect(cityFromHeaders(new Headers())).toBeNull();
    expect(cityFromHeaders(undefined)).toBeNull();
    expect(cityFromHeaders(new Headers({ 'cf-ipcity': '<b>' }))).toBe('b');
    expect(cityFromHeaders(new Headers({ 'cf-ipcity': '<>' }))).toBeNull();
  });
});

describe('deviceLabel', () => {
  it('names the browser and the system', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBe('Chrome on Windows');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(deviceLabel(null)).toBe('Unknown device');
  });
});
