'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  DEFAULT_SHELL_APPEARANCE,
  SHELL_APPEARANCE_EVENT,
  readShellAppearance,
  resolveSurface,
  writeShellAppearance,
  type ShellAppearance,
  type SurfaceAppearance,
} from '@/lib/shell-appearance';

export function useShellAppearance() {
  const [prefs, setPrefs] = useState<ShellAppearance>(DEFAULT_SHELL_APPEARANCE);

  useEffect(() => {
    const sync = () => setPrefs(readShellAppearance());
    sync();
    window.addEventListener(SHELL_APPEARANCE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SHELL_APPEARANCE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((patch: Partial<ShellAppearance>) => {
    const next = { ...readShellAppearance(), ...patch };
    writeShellAppearance(next);
    setPrefs(next);
  }, []);

  const patchHero = useCallback((patch: Partial<SurfaceAppearance>) => {
    const current = readShellAppearance();
    const next = { ...current, hero: { ...current.hero, ...patch } };
    writeShellAppearance(next);
    setPrefs(next);
  }, []);

  const patchSidebar = useCallback((patch: Partial<SurfaceAppearance>) => {
    const current = readShellAppearance();
    const next = { ...current, sidebar: { ...current.sidebar, ...patch } };
    writeShellAppearance(next);
    setPrefs(next);
  }, []);

  const hero = useMemo(() => resolveSurface(prefs.hero, 'hero'), [prefs.hero]);
  const sidebar = useMemo(() => resolveSurface(prefs.sidebar, 'sidebar'), [prefs.sidebar]);
  const osReduce = useReducedMotion();
  const reduceMotion = Boolean(osReduce) || prefs.reduceMotion || prefs.motion === 'none';

  return {
    prefs,
    hero,
    sidebar,
    reduceMotion,
    motion: prefs.motion,
    update,
    patchHero,
    patchSidebar,
  };
}
