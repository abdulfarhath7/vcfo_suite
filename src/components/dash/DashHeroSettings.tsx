'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { usePathname } from 'next/navigation';
import { roleFromAppPathname, roleSettingsPath } from '@/lib/auth-routes';
import {
  HERO_SOLIDS,
  MOTION_STYLES,
  SIDEBAR_SOLIDS,
  type MotionStyle,
} from '@/lib/shell/shell-appearance';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { SurfacePicker } from '@/views/settings/AppearanceSettings';

/**
 * The greeting card's settings popover — hero skin, sidebar skin, animations.
 * Lives in the dash kit because every dashboard's hero carries it; the settings
 * link resolves per role, so it works the same for a lead, an admin, a super
 * admin or a client.
 */

export function DashHeroSettings() {
  const { prefs, patchHero, patchSidebar, update } = useShellAppearance();
  // Resolved from the URL, not the app context: the hero renders in every role
  // shell, and this keeps it independent of any provider above it.
  const pathname = usePathname();
  const settingsHref = `${roleSettingsPath(roleFromAppPathname(pathname ?? '') ?? 'intern')}#appearance`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Greeting card settings"
          className="grid h-7 w-7 place-items-center rounded-md text-side-muted transition-colors hover:bg-side-active hover:text-side-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[21rem] overflow-hidden rounded-lg border-line p-0 shadow-float"
      >
        <div className="max-h-[min(70vh,32rem)] space-y-3.5 overflow-y-auto overscroll-contain p-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Greeting card
            </p>
            <div className="mt-2">
              <SurfacePicker dense value={prefs.hero} solids={HERO_SOLIDS} onChange={patchHero} />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Sidebar
            </p>
            <div className="mt-2">
              <SurfacePicker dense value={prefs.sidebar} solids={SIDEBAR_SOLIDS} onChange={patchSidebar} />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Animations
            </p>
            <SegmentedPicker
              value={prefs.motion}
              options={MOTION_STYLES.map((style) => ({ value: style.id, label: style.label }))}
              onChange={(next) => update({ motion: next as MotionStyle })}
              ariaLabel="Animations"
              size="sm"
              className="mt-2"
            />
            <div className="mt-2.5 flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-2.5 py-2">
              <span className="text-[12px] font-medium text-ink">Reduce motion</span>
              <Switch
                checked={prefs.reduceMotion}
                onCheckedChange={(checked) => update({ reduceMotion: checked })}
                aria-label="Reduce motion"
              />
            </div>
          </div>

          <Link
            href={settingsHref}
            className="block border-t border-line pt-2 text-[11px] font-medium text-ink-muted hover:text-ink hover:underline"
          >
            More in Settings
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
