import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SidePanel } from './common';

/**
 * The client side panel puts its main action in the bottom-right corner, under the Ask VCFO pill.
 * While a panel is open the shell carries `sheet-open`, which hides the pill (21-runtime.css), so
 * a click on "Open the step" reaches the panel and not the chat.
 */
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function shell() {
  const cp = document.createElement('div');
  cp.className = 'cp';
  document.body.appendChild(cp);
  return cp;
}

describe('SidePanel and the Ask VCFO pill', () => {
  it('sets sheet-open on the shell while it is open and removes it on close', () => {
    const cp = shell();
    const view = render(<SidePanel labelledBy="t" title="Board resolution" onClose={() => {}} footer={<a href="/x">Open the step</a>} />);
    expect(cp.classList.contains('sheet-open')).toBe(true);
    view.unmount();
    expect(cp.classList.contains('sheet-open')).toBe(false);
  });

  it('leaves the class alone when something else set it first', () => {
    const cp = shell();
    cp.classList.add('sheet-open');
    const view = render(<SidePanel labelledBy="t" title="Board resolution" onClose={() => {}} />);
    view.unmount();
    expect(cp.classList.contains('sheet-open')).toBe(true);
  });
});
