'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Check, Upload } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/context/AppContext';
import { internFirstName } from '@/lib/intern-work';
import {
  HERO_SOLIDS,
  MOTION_STYLES,
  SIDEBAR_SOLIDS,
  SURFACE_PRESETS,
  compressImageFile,
  surfaceCssVars,
  type MotionStyle,
  type SurfaceAppearance,
  type SurfaceKind,
} from '@/lib/shell-appearance';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import { toastError } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';

const KINDS: { id: SurfaceKind; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'preset', label: 'Images' },
  { id: 'custom', label: 'Upload' },
];

function Swatch({
  selected,
  label,
  style,
  onClick,
  dense = false,
  caption = false,
}: {
  selected: boolean;
  label: string;
  style: CSSProperties;
  onClick: () => void;
  dense?: boolean;
  caption?: boolean;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      data-on={selected ? 'true' : 'false'}
      className={
        dense
          ? cn(
              'relative h-8 w-full overflow-hidden rounded-md ring-1 ring-black/10 transition-[transform,box-shadow] hover:-translate-y-px',
              selected && 'ring-2 ring-brand ring-offset-1 ring-offset-popover',
            )
          : 'appear-swatch group'
      }
      style={style}
    >
      {selected ? (
        <span className="absolute inset-0 grid place-items-center bg-black/15">
          <span
            className={cn(
              'grid place-items-center rounded-full bg-white text-slate-900 shadow-sm',
              dense ? 'h-4 w-4' : 'h-5 w-5',
            )}
          >
            <Check className={dense ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={3} />
          </span>
        </span>
      ) : dense || caption ? null : (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
          {label}
        </span>
      )}
    </button>
  );

  if (dense || !caption) return button;

  return (
    <div className="min-w-0 space-y-1.5">
      {button}
      <p
        className={cn(
          'truncate text-center text-[11px] tracking-tight',
          selected ? 'font-medium text-ink' : 'text-ink-muted',
        )}
      >
        {label}
      </p>
    </div>
  );
}

function KindTabs({
  value,
  onChange,
  dense = false,
}: {
  value: SurfaceKind;
  onChange: (kind: SurfaceKind) => void;
  dense?: boolean;
}) {
  return (
    <div
      className={
        dense
          ? 'flex rounded-lg bg-surface-sunken/60 p-0.5'
          : 'grid grid-cols-4 rounded-md bg-surface-sunken/70 p-0.5'
      }
    >
      {KINDS.map((kind) => (
        <button
          key={kind.id}
          type="button"
          onClick={() => onChange(kind.id)}
          className={cn(
            'font-semibold transition-colors',
            dense
              ? 'flex-1 rounded-md px-1.5 py-1 text-[10.5px] tracking-wide'
              : 'rounded-md px-2 py-1.5 text-[12px]',
            value === kind.id
              ? dense
                ? 'bg-surface-raised text-ink shadow-sm'
                : 'bg-surface-raised text-ink shadow-sm ring-1 ring-line/70'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {kind.label}
        </button>
      ))}
    </div>
  );
}

export function SurfacePicker({
  value,
  solids,
  onChange,
  dense = false,
}: {
  value: SurfaceAppearance;
  solids: readonly { id: string; label: string; value: string }[];
  onChange: (patch: Partial<SurfaceAppearance>) => void;
  dense?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const customDataUrl = await compressImageFile(file);
      onChange({ kind: 'custom', customDataUrl });
    } catch (err) {
      toastError('Could not use that image', err instanceof Error ? err.message : 'Try another file.');
    }
  };

  return (
    <div className={dense ? 'space-y-2.5' : 'mt-4 space-y-3.5'}>
      <KindTabs dense={dense} value={value.kind} onChange={(kind) => onChange({ kind })} />

      {value.kind === 'solid' ? (
        <div className={dense ? 'grid grid-cols-8 gap-1.5' : 'grid grid-cols-4 gap-2 sm:grid-cols-8'}>
          {solids.map((solid) => (
            <Swatch
              key={solid.id}
              dense={dense}
              label={solid.label}
              selected={value.solidId === solid.id}
              style={{ background: solid.value }}
              onClick={() => onChange({ kind: 'solid', solidId: solid.id })}
            />
          ))}
        </div>
      ) : null}

      {value.kind === 'preset' ? (
        <div className={dense ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-3 gap-2.5 sm:grid-cols-6'}>
          {SURFACE_PRESETS.map((preset) => (
            <Swatch
              key={preset.id}
              dense={dense}
              caption={!dense}
              label={preset.label}
              selected={value.presetId === preset.id}
              style={{
                backgroundImage: `url(${preset.src})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                height: dense ? 40 : 72,
              }}
              onClick={() => onChange({ kind: 'preset', presetId: preset.id })}
            />
          ))}
        </div>
      ) : null}

      {value.kind === 'custom' ? (
        <div className={cn('flex items-center', dense ? 'gap-2.5' : 'gap-3')}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={
              dense
                ? 'relative flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-sunken ring-1 ring-line'
                : cn(
                    'appear-swatch flex h-16 w-24 shrink-0 items-center justify-center text-ink-muted',
                    value.customDataUrl && 'data-on',
                  )
            }
            style={
              value.customDataUrl
                ? {
                    backgroundImage: `url(${value.customDataUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : dense
                  ? undefined
                  : { background: 'oklch(var(--muted))' }
            }
            data-on={value.customDataUrl ? 'true' : 'false'}
            aria-label={value.customDataUrl ? 'Replace photo' : 'Upload photo'}
          >
            {!value.customDataUrl ? (
              <Upload className={cn('text-ink-muted', dense ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
            ) : null}
          </button>
          <div className="min-w-0">
            <p className={cn('font-medium text-ink', dense ? 'text-[12px]' : 'text-[13px]')}>
              Your image
            </p>
            {dense ? null : (
              <p className="mt-0.5 text-[12px] text-ink-muted">JPEG or PNG.</p>
            )}
            <button
              type="button"
              className={cn(
                'font-semibold text-brand hover:underline',
                dense ? 'mt-0.5 text-[11.5px]' : 'mt-1.5 text-[12px]',
              )}
              onClick={() => fileRef.current?.click()}
            >
              {value.customDataUrl ? (dense ? 'Replace' : 'Replace photo') : dense ? 'Upload' : 'Upload photo'}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AppearanceSettings() {
  const { user } = useApp();
  const { prefs, hero, sidebar, patchHero, patchSidebar, update } = useShellAppearance();
  const first = internFirstName(user?.name);

  return (
    <section id="appearance" className="scroll-mt-24">
      <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
        <header className="px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Appearance</h2>
        </header>

        <StudioBlock title="Greeting Card Appearance">
          <div
            className="lead-hero px-5 py-4 sm:px-6 sm:py-5"
            data-hero-image={hero.image ? 'true' : 'false'}
            style={surfaceCssVars(hero, 'hero')}
          >
            <div className="relative z-[2] min-w-0">
              <p className="font-mono text-[10px] tracking-[0.08em] text-white/55">Live preview</p>
              <p className="serif mt-1.5 text-[1.45rem] font-semibold leading-tight text-white">
                Good morning, {first}
              </p>
              <p className="mt-1.5 text-[12px] text-white/65">2 overdue</p>
              <div className="mt-4 h-px bg-white/15" />
              <div className="mt-3.5 flex gap-4 text-[12px] text-white/75">
                <span>
                  <b className="serif text-[15px] font-semibold text-white">12</b> Action
                </span>
                <span className="border-l border-white/20 pl-4">
                  <b className="serif text-[15px] font-semibold text-white">2</b> Overdue
                </span>
                <span className="hidden border-l border-white/20 pl-4 sm:inline">
                  <b className="serif text-[15px] font-semibold text-white">4</b> Waiting
                </span>
              </div>
            </div>
          </div>
          <SurfacePicker value={prefs.hero} solids={HERO_SOLIDS} onChange={patchHero} />
        </StudioBlock>

        <StudioBlock title="Sidebar Appearance">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div
              className="shell-sidebar-skin relative h-[176px] w-[104px] shrink-0 overflow-hidden rounded-lg border border-line/70"
              data-ink={sidebar.ink}
              style={surfaceCssVars(sidebar, 'sidebar')}
            >
              <div className="relative z-[1] space-y-1.5 p-2.5">
                <div className="h-1.5 w-10 rounded-full bg-current opacity-80" />
                <div className="h-6 rounded-md bg-current opacity-[0.12] ring-1 ring-current/20" />
                <div className="h-5 rounded-md bg-current opacity-[0.08]" />
                <div className="h-5 rounded-md bg-current opacity-[0.08]" />
                <div className="h-5 rounded-md bg-current opacity-[0.08]" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <SurfacePicker value={prefs.sidebar} solids={SIDEBAR_SOLIDS} onChange={patchSidebar} />
            </div>
          </div>
        </StudioBlock>

        <StudioBlock title="Animations" last>
          <SegmentedPicker
            value={prefs.motion}
            options={MOTION_STYLES.map((style) => ({ value: style.id, label: style.label }))}
            onChange={(next) => update({ motion: next as MotionStyle })}
            ariaLabel="Animations"
            className="inline-grid"
          />
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/60 pt-4">
            <div>
              <p className="text-[13px] font-medium text-ink">Reduce motion</p>
            </div>
            <Switch
              checked={prefs.reduceMotion}
              onCheckedChange={(checked) => update({ reduceMotion: checked })}
              aria-label="Reduce motion"
            />
          </div>
        </StudioBlock>
      </div>
    </section>
  );
}

function StudioBlock({
  title,
  description,
  last,
  children,
}: {
  title: string;
  description?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('border-t border-line/70 px-5 py-5 sm:px-6', last && 'pb-6')}>
      <h3 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}
