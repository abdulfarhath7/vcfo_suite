import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHELL_APPEARANCE,
  SIDEBAR_SOLIDS,
  parseShellAppearance,
  resolveSurface,
} from '@/lib/shell-appearance';

describe('parseShellAppearance', () => {
  it('returns defaults for garbage input', () => {
    expect(parseShellAppearance(null)).toEqual(DEFAULT_SHELL_APPEARANCE);
    expect(parseShellAppearance('nope')).toEqual(DEFAULT_SHELL_APPEARANCE);
  });

  it('keeps known motion styles and surfaces', () => {
    const parsed = parseShellAppearance({
      hero: { kind: 'solid', solidId: 'ocean' },
      sidebar: { kind: 'gradient', gradientId: 'tide' },
      motion: 'ambient',
      reduceMotion: true,
    });
    expect(parsed.hero.kind).toBe('solid');
    expect(parsed.hero.solidId).toBe('ocean');
    expect(parsed.sidebar.kind).toBe('gradient');
    expect(parsed.sidebar.gradientId).toBe('tide');
    expect(parsed.motion).toBe('ambient');
    expect(parsed.reduceMotion).toBe(true);
  });
});

describe('resolveSurface', () => {
  it('uses light ink on dark sidebar solids and images', () => {
    const midnight = resolveSurface(
      { ...DEFAULT_SHELL_APPEARANCE.sidebar, kind: 'solid', solidId: 'midnight' },
      'sidebar',
    );
    expect(midnight.ink).toBe('light');
    expect(midnight.image).toBe(false);

    const glass = resolveSurface(DEFAULT_SHELL_APPEARANCE.sidebar, 'sidebar');
    expect(glass.ink).toBe('dark');
    expect(glass.background).toBe('oklch(var(--panel))');
    expect(SIDEBAR_SOLIDS.find((s) => s.id === 'glass')?.value).toBe('oklch(var(--panel))');

    const preset = resolveSurface(
      { ...DEFAULT_SHELL_APPEARANCE.hero, kind: 'preset', presetId: 'night' },
      'hero',
    );
    expect(preset.image).toBe(true);
    expect(preset.ink).toBe('light');
    expect(preset.overlay).not.toBe('transparent');
  });

  it('strengthens sidebar photo overlays for light-ink labels', () => {
    const preset = resolveSurface(
      { ...DEFAULT_SHELL_APPEARANCE.sidebar, kind: 'preset', presetId: 'peak' },
      'sidebar',
    );
    expect(preset.ink).toBe('light');
    expect(preset.overlay).toBe(
      'linear-gradient(180deg, rgb(15 23 42 / 0.34) 0%, rgb(15 23 42 / 0.52) 100%)',
    );

    const custom = resolveSurface(
      {
        ...DEFAULT_SHELL_APPEARANCE.sidebar,
        kind: 'custom',
        customDataUrl: 'data:image/jpeg;base64,xx',
      },
      'sidebar',
    );
    expect(custom.ink).toBe('light');
    expect(custom.overlay).toBe(
      'linear-gradient(180deg, rgb(15 23 42 / 0.38) 0%, rgb(15 23 42 / 0.55) 100%)',
    );
  });
});
