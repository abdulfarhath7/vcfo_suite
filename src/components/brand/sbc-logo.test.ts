import { describe, expect, it } from 'vitest';
import {
  SBC_LOCKUP_DARK_SRC,
  SBC_LOCKUP_LIGHT_SRC,
  sbcLockupSrc,
} from '@/components/brand/SbcLogo';

describe('sbcLockupSrc', () => {
  it('points at the canonical theme files', () => {
    expect(SBC_LOCKUP_LIGHT_SRC).toBe('/sbc-logo-light.png');
    expect(SBC_LOCKUP_DARK_SRC).toBe('/sbc-logo-dark.png');
    expect(sbcLockupSrc('light')).toBe('/sbc-logo-light.png');
    expect(sbcLockupSrc('dark')).toBe('/sbc-logo-dark.png');
  });
});
