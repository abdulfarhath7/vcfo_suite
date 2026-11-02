import type { KeyboardEvent } from 'react';

/**
 * The keyboard half of a click handler, for an element that carries role="button" but cannot be a
 * native <button> (for example a block that a button would lay out differently). Enter and Space
 * run the handler, as they do on a real button. Keys pressed on a control nested inside the
 * element are ignored, so those controls keep their own behaviour.
 *
 * Use it as `role="button" tabIndex={0} onClick={run} onKeyDown={onActivate(run)}`.
 */
export function onActivate<E extends Element>(handler: () => void) {
  return (e: KeyboardEvent<E>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}
