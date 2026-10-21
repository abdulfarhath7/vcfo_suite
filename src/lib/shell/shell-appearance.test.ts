import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHELL_APPEARANCE,
  SIDEBAR_SOLIDS,
  parseShellAppearance,
  resolveSurface,
} from '@/lib/shell/shell-appearance';

describe('parseShellAppearance', () => {
  it('returns defaults for garbage input', () => {
    expect(parseShellAppearance(null)).toEqual(DEFAULT_SHELL_APPEARANCE);
    expect(parseShellAppearance('nope')).toEqual(DEFAULT_SHELL_APPEARANCE);
  });

  it('keeps known motion styles and folds retired skins into the ones that exist', () => {
    const parsed = parseShellAppearance({
      hero: { kind: 'solid', solidId: 'ocean' },
      sidebar: { kind: 'gradient', gradientId: 'tide' },
      motion: 'ambient',
      reduceMotion: true,
    });
    // The hero has one skin now; any stored solid resolves to it.
    expect(parsed.hero.kind).toBe('solid');
    expect(parsed.hero.solidId).toBe('navy');
    // Gradients left with the design system: a stored gradient becomes the navy solid.
    expect(parsed.sidebar.kind).toBe('solid');
    expect(parsed.sidebar.solidId).toBe('navy');
    expect(parsed.motion).toBe('ambient');
    expect(parsed.reduceMotion).toBe(true);
  });

  it('maps the old light sidebar solids to white and the dark ones to navy', () => {
    const light = parseShellAppearance({ sidebar: { kind: 'solid', solidId: 'mist' } });
    expect(light.sidebar.solidId).toBe('glass');
    const dark = parseShellAppearance({ sidebar: { kind: 'solid', solidId: 'midnight' } });
    expect(dark.sidebar.solidId).toBe('navy');
  });
});

describe('resolveSurface', () => {
  it('uses light ink on the navy sidebar and on images, dark ink on the white sidebar', () => {
    const navy = resolveSurface(DEFAULT_SHELL_APPEARANCE.sidebar, 'sidebar');
    expect(navy.ink).toBe('light');
    expect(navy.image).toBe(false);
    expect(navy.background).toBe('oklch(var(--side))');

    const glass = resolveSurface(
      { ...DEFAULT_SHELL_APPEARANCE.sidebar, kind: 'solid', solidId: 'glass' },
      'sidebar',
    );
    expect(glass.ink).toBe('dark');
    expect(glass.background).toBe('oklch(var(--surface-raised))');
    expect(SIDEBAR_SOLIDS.find((s) => s.id === 'glass')?.value).toBe('oklch(var(--surface-raised))');

    const hero = resolveSurface(DEFAULT_SHELL_APPEARANCE.hero, 'hero');
    expect(hero.ink).toBe('light');
    expect(hero.background).toBe('oklch(var(--side))');

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
