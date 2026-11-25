'use client';

import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { useFillMode, useFillSpeed, type FillMode, type FillSpeed } from './fill-mode';

const OPTIONS = [
  { value: 'manual' as FillMode, label: 'Manual' },
  { value: 'auto' as FillMode, label: 'Auto' },
];

const SPEED_OPTIONS = [
  { value: 'watch' as FillSpeed, label: 'Watch it fill' },
  { value: 'instant' as FillSpeed, label: 'Fill instantly' },
];

/** The speed choice on its own, for the composer and the fill rail (a switch applies from the next field). */
export function FillSpeedPicker({ labelledBy, className }: { labelledBy?: string; className?: string }) {
  const [speed, setSpeed] = useFillSpeed();
  return (
    <SegmentedPicker
      value={speed}
      options={SPEED_OPTIONS}
      onChange={setSpeed}
      ariaLabel={labelledBy ? undefined : 'Fill speed'}
      labelledBy={labelledBy}
      size="sm"
      className={className ?? 'w-[13.5rem]'}
    />
  );
}

/**
 * How "Fill into app" runs, like a chat mode: Manual types each page in front of you and waits
 * for Accept; Auto saves every step by itself. Beside it, the speed: "Watch it fill" types each
 * field with the ghost cursor, "Fill instantly" sets the page at once (always so under reduced
 * motion). Both are remembered in this browser (staff only).
 */
export function FillModeChip() {
  const [mode, setMode] = useFillMode();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-1">
      <span id="ask-fill-mode-label" className="text-[12px] text-ink-muted">
        Fill into app
      </span>
      <SegmentedPicker
        value={mode}
        options={OPTIONS}
        onChange={setMode}
        labelledBy="ask-fill-mode-label"
        size="sm"
        className="w-[9.5rem]"
      />
      <FillSpeedPicker />
    </div>
  );
}
