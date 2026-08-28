export const SHELL_APPEARANCE_KEY = 'vcfo.shell.appearance';
export const SHELL_APPEARANCE_EVENT = 'vcfo-appearance';

export type SurfaceKind = 'solid' | 'gradient' | 'preset' | 'custom';
export type MotionStyle = 'none' | 'minimal' | 'smooth' | 'dynamic' | 'ambient';

export type SurfaceAppearance = {
  kind: SurfaceKind;
  solidId: string;
  gradientId: string;
  presetId: string;
  customDataUrl: string | null;
};

export type ShellAppearance = {
  hero: SurfaceAppearance;
  sidebar: SurfaceAppearance;
  motion: MotionStyle;
  reduceMotion: boolean;
};

export const HERO_SOLIDS = [
  { id: 'midnight', label: 'Midnight', value: '#0F172A' },
  { id: 'ocean', label: 'Ocean', value: '#0F3D5E' },
  { id: 'indigo', label: 'Indigo', value: '#312E81' },
  { id: 'slate', label: 'Slate', value: '#334155' },
  { id: 'forest', label: 'Forest', value: '#134E4A' },
  { id: 'violet', label: 'Violet', value: '#4C1D95' },
  { id: 'ink', label: 'Ink', value: '#111827' },
  { id: 'steel', label: 'Steel', value: '#1E293B' },
] as const;

export const SIDEBAR_SOLIDS = [
  /* Opaque: theme-aware panel. Alpha + blur used to frost the page; a full-rail
     backdrop-filter re-blurs on every hover-peek frame. Porcelain stays #F8FAFC. */
  { id: 'glass', label: 'Glass', value: 'oklch(var(--panel))' },
  { id: 'white', label: 'Porcelain', value: '#F8FAFC' },
  { id: 'mist', label: 'Mist', value: '#EEF2FF' },
  { id: 'ice', label: 'Ice', value: '#ECFEFF' },
  { id: 'sage', label: 'Sage', value: '#F0FDFA' },
  { id: 'midnight', label: 'Midnight', value: '#0F172A' },
  { id: 'indigo', label: 'Indigo', value: '#1E1B4B' },
  { id: 'slate', label: 'Slate', value: '#1E293B' },
] as const;

export const SURFACE_GRADIENTS = [
  { id: 'aurora', label: 'Aurora', value: 'linear-gradient(115deg, #1D4ED8 0%, #6D28D9 52%, #DB2777 100%)' },
  { id: 'dusk', label: 'Dusk', value: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #4338CA 100%)' },
  { id: 'tide', label: 'Tide', value: 'linear-gradient(120deg, #0E7490 0%, #2563EB 100%)' },
  { id: 'orchid', label: 'Orchid', value: 'linear-gradient(125deg, #4F46E5 0%, #7C3AED 48%, #C026D3 100%)' },
  { id: 'horizon', label: 'Horizon', value: 'linear-gradient(105deg, #0369A1 0%, #4F46E5 100%)' },
  { id: 'glacier', label: 'Glacier', value: 'linear-gradient(160deg, #0F766E 0%, #1D4ED8 100%)' },
] as const;

export const SURFACE_PRESETS = [
  {
    id: 'linen',
    label: 'Linen',
    src: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1400&q=70',
  },
  {
    id: 'wash',
    label: 'Wash',
    src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1400&q=70',
  },
  {
    id: 'atlas',
    label: 'Atlas',
    src: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=70',
  },
  {
    id: 'night',
    label: 'Night',
    src: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1400&q=70',
  },
  {
    id: 'peak',
    label: 'Peak',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=70',
  },
  {
    id: 'silk',
    label: 'Silk',
    src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=70',
  },
] as const;

export const MOTION_STYLES: { id: MotionStyle; label: string; hint: string }[] = [
  { id: 'none', label: 'None', hint: 'Static surfaces' },
  { id: 'minimal', label: 'Minimal', hint: 'Soft fades only' },
  { id: 'smooth', label: 'Smooth', hint: 'Quiet springs' },
  { id: 'dynamic', label: 'Dynamic', hint: 'Snappier motion' },
  { id: 'ambient', label: 'Ambient', hint: 'Slow atmosphere' },
];

const defaultHero: SurfaceAppearance = {
  kind: 'gradient',
  solidId: 'midnight',
  gradientId: 'dusk',
  presetId: 'linen',
  customDataUrl: null,
};

const defaultSidebar: SurfaceAppearance = {
  kind: 'solid',
  solidId: 'glass',
  gradientId: 'dusk',
  presetId: 'wash',
  customDataUrl: null,
};

export const DEFAULT_SHELL_APPEARANCE: ShellAppearance = {
  hero: defaultHero,
  sidebar: defaultSidebar,
  motion: 'smooth',
  reduceMotion: false,
};

function asSurface(raw: unknown, fallback: SurfaceAppearance): SurfaceAppearance {
  if (!raw || typeof raw !== 'object') return fallback;
  const row = raw as Partial<SurfaceAppearance>;
  const kind: SurfaceKind =
    row.kind === 'solid' || row.kind === 'gradient' || row.kind === 'preset' || row.kind === 'custom'
      ? row.kind
      : fallback.kind;
  return {
    kind,
    solidId: typeof row.solidId === 'string' ? row.solidId : fallback.solidId,
    gradientId: typeof row.gradientId === 'string' ? row.gradientId : fallback.gradientId,
    presetId: typeof row.presetId === 'string' ? row.presetId : fallback.presetId,
    customDataUrl: typeof row.customDataUrl === 'string' ? row.customDataUrl : fallback.customDataUrl,
  };
}

export function parseShellAppearance(raw: unknown): ShellAppearance {
  if (!raw || typeof raw !== 'object') return DEFAULT_SHELL_APPEARANCE;
  const row = raw as Partial<ShellAppearance>;
  const motion: MotionStyle = MOTION_STYLES.some((m) => m.id === row.motion)
    ? (row.motion as MotionStyle)
    : 'smooth';
  return {
    hero: asSurface(row.hero, defaultHero),
    sidebar: asSurface(row.sidebar, defaultSidebar),
    motion,
    reduceMotion: Boolean(row.reduceMotion),
  };
}

export function readShellAppearance(): ShellAppearance {
  if (typeof window === 'undefined') return DEFAULT_SHELL_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(SHELL_APPEARANCE_KEY);
    if (!raw) return DEFAULT_SHELL_APPEARANCE;
    return parseShellAppearance(JSON.parse(raw));
  } catch {
    return DEFAULT_SHELL_APPEARANCE;
  }
}

export function writeShellAppearance(next: ShellAppearance): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHELL_APPEARANCE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SHELL_APPEARANCE_EVENT));
  } catch {
    /* quota */
  }
}

export type ResolvedSurface = {
  background: string;
  overlay: string;
  ink: 'light' | 'dark';
  image: boolean;
};

function findSolid(id: string, list: readonly { id: string; value: string }[], fallback: string): string {
  return list.find((s) => s.id === id)?.value ?? fallback;
}

export function surfaceCssVars(
  resolved: ResolvedSurface,
  role: 'hero' | 'sidebar',
): Record<string, string> {
  if (role === 'hero') {
    return {
      '--hero-surface-bg': resolved.background,
      '--hero-surface-overlay': resolved.overlay,
    };
  }
  return {
    '--sidebar-surface-bg': resolved.background,
    '--sidebar-surface-overlay': resolved.overlay,
  };
}

export function resolveSurface(surface: SurfaceAppearance, role: 'hero' | 'sidebar'): ResolvedSurface {
  if (surface.kind === 'custom' && surface.customDataUrl) {
    return {
      background: `center / cover no-repeat url("${surface.customDataUrl}")`,
      overlay:
        role === 'hero'
          ? 'linear-gradient(180deg, rgb(15 23 42 / 0.42) 0%, rgb(15 23 42 / 0.62) 100%)'
          : 'linear-gradient(180deg, rgb(15 23 42 / 0.38) 0%, rgb(15 23 42 / 0.55) 100%)',
      ink: 'light',
      image: true,
    };
  }
  if (surface.kind === 'preset') {
    const preset = SURFACE_PRESETS.find((p) => p.id === surface.presetId) ?? SURFACE_PRESETS[0];
    return {
      background: `center / cover no-repeat url("${preset.src}")`,
      overlay:
        role === 'hero'
          ? 'linear-gradient(180deg, rgb(15 23 42 / 0.38) 0%, rgb(15 23 42 / 0.58) 100%)'
          : 'linear-gradient(180deg, rgb(15 23 42 / 0.34) 0%, rgb(15 23 42 / 0.52) 100%)',
      ink: 'light',
      image: true,
    };
  }
  if (surface.kind === 'gradient') {
    const g = SURFACE_GRADIENTS.find((row) => row.id === surface.gradientId) ?? SURFACE_GRADIENTS[0];
    return {
      background: g.value,
      overlay: 'transparent',
      ink: 'light',
      image: false,
    };
  }
  if (role === 'sidebar') {
    const value = findSolid(surface.solidId, SIDEBAR_SOLIDS, SIDEBAR_SOLIDS[0].value);
    const dark = surface.solidId === 'midnight' || surface.solidId === 'indigo' || surface.solidId === 'slate';
    return {
      background: value,
      overlay: 'transparent',
      ink: dark ? 'light' : 'dark',
      image: false,
    };
  }
  const value = findSolid(surface.solidId, HERO_SOLIDS, HERO_SOLIDS[0].value);
  return { background: value, overlay: 'transparent', ink: 'light', image: false };
}

export function compressImageFile(file: File, maxEdge = 1400, quality = 0.74): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file.'));
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read image.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image.'));
    };
    img.src = objectUrl;
  });
}
