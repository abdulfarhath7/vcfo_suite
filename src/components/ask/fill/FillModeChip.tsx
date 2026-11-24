'use client';

import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { useFillMode, type FillMode } from './fill-mode';

const OPTIONS = [
  { value: 'manual' as FillMode, label: 'Manual' },
  { value: 'auto' as FillMode, label: 'Auto' },
];

/**
 * How "Fill into app" runs, like a chat mode: Manual types each page in front of you and waits
 * for Accept; Auto saves every step by itself. Remembered in this browser (staff only).
 */
export function FillModeChip() {
  const [mode, setMode] = useFillMode();
  return (
    <div className="flex items-center gap-2 px-1">
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
    </div>
  );
}
