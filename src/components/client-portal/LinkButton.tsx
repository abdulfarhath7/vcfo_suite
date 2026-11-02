import type { ButtonHTMLAttributes } from 'react';

/**
 * The portal's in-page actions were drawn by the prototype as `<a href="#">`. This is the button
 * that replaces them. The utilities re-create what the portal's `a` rule gives an anchor
 * (inline, brand colour, bold, darker on hover, inherited alignment and case) at the lowest
 * specificity, so a class (`btn`, `ask`, `rt`, `row`...) or an inline style still wins exactly as
 * it did on the anchor. The portal reverts Tailwind's preflight (00-tokens.css), so the native
 * button border, background, padding and font are reset here too; without that every in-page
 * action drew as a grey bordered system button.
 */
/* The anchor look lives in css-src/10-base.css as `:where(.lbtn)`: it beats the portal reset
   (`:root :where(...){all:revert}`), which loads first, and loses to any class or inline style. */
const LINK_LOOK = 'lbtn';

export function LinkButton({ className, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) {
  return <button type="button" className={className ? `${LINK_LOOK} ${className}` : LINK_LOOK} {...rest} />;
}
