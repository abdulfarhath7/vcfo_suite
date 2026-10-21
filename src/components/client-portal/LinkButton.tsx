import type { ButtonHTMLAttributes } from 'react';

/**
 * The portal's in-page actions were drawn by the prototype as `<a href="#">`. This is the button
 * that replaces them. The utilities re-create what the portal's `a` rule gives an anchor
 * (inline, brand colour, bold, darker on hover, inherited alignment and case) at the lowest
 * specificity, so a class (`btn`, `ask`, `rt`, `row`...) or an inline style still wins exactly as
 * it did on the anchor. Tailwind's preflight already strips the native button border, background,
 * padding and font.
 */
const LINK_LOOK =
  'inline cursor-pointer [text-align:inherit] [text-transform:inherit] font-bold text-[color:var(--primary)] hover:text-[color:var(--primary-dark)]';

export function LinkButton({ className, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) {
  return <button type="button" className={className ? `${LINK_LOOK} ${className}` : LINK_LOOK} {...rest} />;
}
