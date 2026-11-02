/* Navigation icons are one step fainter than their label (R-45: side-muted on
   the navy sidebar, ink-muted on the white one; `sidebarIdleIconClass` sets it);
   the active item alone changes colour. The per-function hues that used to live
   here were one of the "different colours everywhere" sources the design system
   removes (docs/design/AUDIT.md). The keys stay so the nav definitions do not
   change, and add nothing to the idle colour. */
const INHERIT = '';

export const TONE = {
  home: INHERIT,
  work: INHERIT,
  queue: INHERIT,
  people: INHERIT,
  calendar: INHERIT,
  files: INHERIT,
  knowledge: INHERIT,
  news: INHERIT,
  analytics: INHERIT,
  audit: INHERIT,
} as const;
