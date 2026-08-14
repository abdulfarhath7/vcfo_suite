import { describe, expect, it } from 'vitest';

import {
  mergeRegisteredOfficeIntoPre6,
  registeredOfficeCompleteAddress,
  resolveRegisteredOfficeResponses,
} from '@/lib/registered-office-responses';

describe('resolveRegisteredOfficeResponses', () => {
  it('prefers Pre-6 over legacy Pre-8 for the same field ids', () => {
    const merged = resolveRegisteredOfficeResponses(
      { registeredOfficeCompleteAddress: 'Pre-6 address' },
      { registeredOfficeCompleteAddress: 'Pre-8 address' },
    );
    expect(merged.registeredOfficeCompleteAddress).toBe('Pre-6 address');
  });

  it('falls back to Pre-8 when Pre-6 is empty', () => {
    const merged = resolveRegisteredOfficeResponses(
      {},
      {
        registeredOfficeCompleteAddress: 'Legacy address',
        registeredOfficeUtilityBillNumber: 'UB-99',
      },
    );
    expect(merged.registeredOfficeCompleteAddress).toBe('Legacy address');
    expect(merged.registeredOfficeUtilityBillNumber).toBe('UB-99');
  });
});

describe('mergeRegisteredOfficeIntoPre6', () => {
  it('fills only empty Pre-6 keys from Pre-8', () => {
    const next = mergeRegisteredOfficeIntoPre6(
      { registeredOfficeCompleteAddress: 'Kept' },
      { registeredOfficeCompleteAddress: 'Legacy', registeredOfficeNocUrl: 'path/noc.pdf' },
    );
    expect(next.registeredOfficeCompleteAddress).toBe('Kept');
    expect(next.registeredOfficeNocUrl).toBe('path/noc.pdf');
  });
});

describe('registeredOfficeCompleteAddress', () => {
  it('reads complete address from merged responses', () => {
    expect(
      registeredOfficeCompleteAddress(
        { registeredOfficeCompleteAddress: '12 MG Road, Bengaluru' },
        {},
      ),
    ).toBe('12 MG Road, Bengaluru');
  });
});
