import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/app/client/incorporation',
  useSearchParams: () => new URLSearchParams(search),
}));

const { useAskFocus, focusCandidates } = await import('@/hooks/ask/useAskFocus');

function Page({ children }: { children?: React.ReactNode }) {
  useAskFocus();
  return <>{children}</>;
}

beforeEach(() => {
  replace.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('useAskFocus', () => {
  it('focuses the target once and removes the arrival params', () => {
    search = 'from=ask&focus=pre-inc-phase-2';
    window.history.replaceState(null, '', '/app/client/incorporation?from=ask&focus=pre-inc-phase-2');
    const { container } = render(
      <Page>
        <div data-ask-focus="pre-inc-phase-2">Part B</div>
      </Page>,
    );
    const el = container.querySelector('[data-ask-focus="pre-inc-phase-2"]')!;
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.className).toMatch(/ask-focus-(pulse|ring)/);
    expect(replace).toHaveBeenCalledWith('/app/client/incorporation', { scroll: false });
  });

  it('does nothing without from=ask', () => {
    search = 'focus=pre-13';
    render(<Page />);
    expect(replace).not.toHaveBeenCalled();
  });

  it('maps a step to its phase row when the page only shows phases', () => {
    expect(focusCandidates('pre-13')).toEqual(['pre-13', 'pre-inc-phase-2']);
  });
});
