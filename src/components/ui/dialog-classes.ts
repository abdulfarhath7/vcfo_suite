/* Shared frame classes for Dialog and AlertDialog (VCFO Spectrum, prototype src/components/ui/Modal.tsx).
   The scrim is navy 42 % (dark: black 60 %). On a phone the dialog is a bottom sheet: full width,
   top corners only, up to 92 % of the screen. From 640px it is a centred box up to 86 % high.
   The body padding is 16px (20px from 768px). The head is at least 52px with a hairline under it
   and the footer has a hairline above it; both run edge to edge through negative margins, which
   apply only while the content keeps its padding (`data-dialog-pad`). A caller that passes `p-0`
   lays out its own head and body. */

export const DIALOG_OVERLAY =
  'discrete-overlay fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';

/* Widths are unprefixed so a caller's own max-w-* class replaces them (tailwind-merge). Phones
   always get the full width (max-sm:!max-w-none in DIALOG_CONTENT). */
export const DIALOG_WIDTHS = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[760px]',
  xl: 'max-w-[1000px]',
} as const;
export type DialogSize = keyof typeof DIALOG_WIDTHS;

export const DIALOG_CONTENT = [
  'discrete-panel discrete-panel-dialog fixed z-50 grid w-full gap-4 overflow-y-auto overscroll-contain border border-line bg-surface-raised p-4 text-ink shadow-dialog outline-none duration-200 md:p-5',
  // Phone: bottom sheet.
  'inset-x-0 bottom-0 top-auto max-h-[92vh] rounded-t-md max-sm:!max-w-none',
  // From 640px: centred box.
  'sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[86vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-md',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 max-sm:data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95',
].join(' ');

/** True when a caller removed the body padding (`p-0`), so the head and footer must not bleed out. */
export function dialogIsFlush(className?: string): boolean {
  return /(^|\s)!?p-0(\s|$)/.test(className ?? '');
}

// Class names are written out in full so Tailwind finds them in this file.
export const DIALOG_HEAD =
  'flex min-h-head flex-col justify-center gap-1 border-b border-line-soft py-3 pr-12 text-left [[data-dialog-pad]_&]:-mx-4 [[data-dialog-pad]_&]:-mt-4 [[data-dialog-pad]_&]:px-4 [[data-dialog-pad]_&]:pr-12 md:[[data-dialog-pad]_&]:-mx-5 md:[[data-dialog-pad]_&]:-mt-5 md:[[data-dialog-pad]_&]:px-5 md:[[data-dialog-pad]_&]:pr-14';

export const DIALOG_FOOT =
  'flex flex-wrap items-center justify-end gap-2 border-t border-line-soft py-3 [[data-dialog-pad]_&]:-mx-4 [[data-dialog-pad]_&]:-mb-4 [[data-dialog-pad]_&]:px-4 md:[[data-dialog-pad]_&]:-mx-5 md:[[data-dialog-pad]_&]:-mb-5 md:[[data-dialog-pad]_&]:px-5';

export const DIALOG_TITLE = 'text-[15px] font-medium leading-snug text-ink';
export const DIALOG_DESCRIPTION = 'text-[12.5px] text-ink-muted';
export const DIALOG_CLOSE =
  'absolute right-3 top-2.5 grid h-8 w-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:pointer-events-none md:right-4';
