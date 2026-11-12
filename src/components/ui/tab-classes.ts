/* Plain module (no 'use client') so server and client components can both read the strings. */

/**
 * GL-03: the one look for the open tab in every tab bar of the app. The open tab has a 3px
 * brand underline, bold brand-colour text and a light brand wash, so it is not shown by colour
 * alone; brand-text holds 4.5:1 on the wash and on every surface in both themes
 * (scripts/design-tokens-check.mjs). The other tabs have muted text and no underline. Hand-made
 * tab bars use these classes instead of their own.
 */
export const TAB_ACTIVE = 'bg-brand-soft font-semibold text-brand-text shadow-[inset_0_-3px_0_0_oklch(var(--brand))]';
export const TAB_INACTIVE = 'font-medium text-ink-muted hover:text-ink';
/** The same open-tab look for Radix `TabsTrigger`, which marks the open tab with data-state. */
export const TAB_ACTIVE_RADIX =
  'data-[state=active]:bg-brand-soft data-[state=active]:font-semibold data-[state=active]:text-brand-text data-[state=active]:shadow-[inset_0_-3px_0_0_oklch(var(--brand))]';

/** The classes for one tab, open or not. */
export function tabStateClass(on: boolean): string {
  return on ? TAB_ACTIVE : TAB_INACTIVE;
}
