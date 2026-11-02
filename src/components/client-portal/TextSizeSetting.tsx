'use client';

import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { PORTAL_TEXT_SIZES, usePortal, type PortalTextSize } from './PortalProvider';

/**
 * Text size for the client portal (Small, Default, Large). It sets `data-text-size` on <html>,
 * which the foundations' appearance rule scales, and on `.cp`. Mount it in Profile > Appearance.
 */
export function TextSizeSetting({ className }: { className?: string }) {
  const { textSize, setTextSize } = usePortal();
  return (
    <SpectrumTabs
      className={className}
      label="Text size"
      items={PORTAL_TEXT_SIZES.map((s) => ({ key: s.value, label: s.label }))}
      value={textSize}
      onChange={(k) => setTextSize(k as PortalTextSize)}
    />
  );
}
