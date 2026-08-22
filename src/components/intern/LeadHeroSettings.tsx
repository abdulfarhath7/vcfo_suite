'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/context/AppContext';
import { roleSettingsPath } from '@/lib/auth-routes';
import {
  HERO_SOLIDS,
  MOTION_STYLES,
  SIDEBAR_SOLIDS,
  type MotionStyle,
} from '@/lib/shell-appearance';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import { cn } from '@/lib/utils';
import { SurfacePicker } from '@/views/settings/AppearanceSettings';

export function LeadHeroSettings() {
  const { user } = useApp();
  const { prefs, patchHero, patchSidebar, update } = useShellAppearance();
  const settingsHref = `${roleSettingsPath(user?.role ?? 'intern')}#appearance`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Greeting card settings"
          className="grid h-7 w-7 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/14 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[21rem] overflow-hidden rounded-xl border-border/80 p-0 shadow-lg"
      >
        <div className="max-h-[min(70vh,32rem)] space-y-3.5 overflow-y-auto overscroll-contain p-3.5">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Greeting card
            </p>
            <div className="mt-2">
              <SurfacePicker dense value={prefs.hero} solids={HERO_SOLIDS} onChange={patchHero} />
            </div>
          </div>

          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Sidebar
            </p>
            <div className="mt-2">
              <SurfacePicker dense value={prefs.sidebar} solids={SIDEBAR_SOLIDS} onChange={patchSidebar} />
            </div>
          </div>

          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Animations
            </p>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {MOTION_STYLES.map((style) => {
                const on = prefs.motion === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    aria-pressed={on}
                    title={style.hint}
                    onClick={() => update({ motion: style.id as MotionStyle })}
                    className={cn(
                      'rounded-md px-0.5 py-1.5 text-center text-[10px] font-semibold leading-none transition-colors',
                      on
                        ? 'bg-primary-light text-primary ring-1 ring-primary/25'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-2.5 py-2">
              <span className="text-[12px] font-medium text-foreground">Reduce motion</span>
              <Switch
                checked={prefs.reduceMotion}
                onCheckedChange={(checked) => update({ reduceMotion: checked })}
                aria-label="Reduce motion"
              />
            </div>
          </div>

          <Link
            href={settingsHref}
            className="block border-t border-border/60 pt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            More in Settings
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
