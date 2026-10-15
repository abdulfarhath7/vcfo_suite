import { describe, expect, it } from 'vitest';
import {
  SBC_LOCKUP_DARK_SRC,
  SBC_LOCKUP_LIGHT_SRC,
  sbcLockupSrc,
} from '@/components/brand/SbcLogo';

describe('sbcLockupSrc', () => {
  it('points at the canonical theme files', () => {
    expect(SBC_LOCKUP_LIGHT_SRC).toBe('/vcfo-logo-light.png');
    expect(SBC_LOCKUP_DARK_SRC).toBe('/vcfo-logo-dark.png');
    expect(sbcLockupSrc('light')).toBe('/vcfo-logo-light.png');
    expect(sbcLockupSrc('dark')).toBe('/vcfo-logo-dark.png');
  });
});
