/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';

describe('DropdownMenu letter keys', () => {
  it('runs the item whose shortcut matches the key and shows the key cap', () => {
    const copy = vi.fn();
    const edit = vi.fn();
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>Row menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem shortcut="e" onSelect={edit}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem shortcut="C" onSelect={copy}>
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole('menuitem', { name: /Copy link/ })).toHaveAttribute('aria-keyshortcuts', 'C');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'c' });
    expect(copy).toHaveBeenCalledOnce();
    expect(edit).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier and items without a shortcut', () => {
    const copy = vi.fn();
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>Row menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem shortcut="c" onSelect={copy}>
            Copy link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'c', ctrlKey: true });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'x' });
    expect(copy).not.toHaveBeenCalled();
  });
});
