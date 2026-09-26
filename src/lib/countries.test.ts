import { describe, expect, it } from 'vitest';

import { COUNTRY_OPTIONS, countryWithArticle, INDIAN_STATE_OPTIONS, inferIndianState } from '@/lib/countries';

describe('countries', () => {
  it('prints the article only where legal text needs it', () => {
    expect(countryWithArticle('United Kingdom')).toBe('the United Kingdom');
    expect(countryWithArticle('Singapore')).toBe('Singapore');
  });

  it('lists India and each state or UT once', () => {
    expect(COUNTRY_OPTIONS.some((o) => o.value === 'India')).toBe(true);
    expect(INDIAN_STATE_OPTIONS).toHaveLength(36);
  });
});

describe('inferIndianState', () => {
  it('finds the one state an address names', () => {
    expect(inferIndianState('Suite 5, Madhapur, Hyderabad, 500081, Telangana, India')).toBe('Telangana');
    expect(inferIndianState('12 MG Road, Bengaluru, Karnataka 560001')).toBe('Karnataka');
    expect(inferIndianState('Connaught Place, New Delhi 110001')).toBe('Delhi');
    expect(inferIndianState('Amalapuram, East Godavari, Andhra Pradesh')).toBe('Andhra Pradesh');
  });

  it('never guesses between two names or from none', () => {
    expect(inferIndianState('Goa office, formerly Kerala')).toBe('');
    expect(inferIndianState('2 Office Lane, Test City, 560001')).toBe('');
    expect(inferIndianState('')).toBe('');
  });
});
