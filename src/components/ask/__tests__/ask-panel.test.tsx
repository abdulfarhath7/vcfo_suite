import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Visual } from '@/data/ask/schema';

let role = 'client';
vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ user: { id: 'u1', role }, engagements: [{ id: 'eng-1', companyName: 'Acme' }] }),
}));
vi.mock('@/hooks/ask/use-ask-status', () => ({
  useAskStatus: (r: string) => ({ enabled: ['client', 'admin', 'super_admin'].includes(r), firmName: 'SBC' }),
}));
vi.mock('@/hooks/ask/use-ask-suggestions', () => ({
  useAskSuggestions: () => ({
    data: { suggestions: [{ id: 'client-gst', group: 'Learn the basics', label: 'What is GST, and do we need it?' }], snapshot: null },
    isError: false,
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/app/client' }));

const { AskShellMount } = await import('@/components/ask/AskShellMount');
const { AskLauncher } = await import('@/components/ask/AskLauncher');
const { isAskShortcut } = await import('@/lib/ask/shortcut');
const { VisualRenderer } = await import('@/components/ask/visuals/VisualRenderer');
const { visualText } = await import('@/components/ask/visuals/visual-text');

function wrap(children: ReactNode) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  role = 'client';
  window.sessionStorage.clear();
});

describe('VisualRenderer', () => {
  it('renders a valid flow with a screen-reader equivalent', () => {
    const visual: Visual = {
      type: 'flow',
      stages: [
        { label: 'Part A', state: 'done' },
        { label: 'Part B', state: 'here' },
      ],
    };
    const { container } = render(<VisualRenderer visual={visual} />);
    expect(container.querySelector('[data-visual="flow"]')).not.toBeNull();
    expect(screen.getByText('Stage 1 of 2, Part A, done. Stage 2 of 2, Part B, you are here.')).toBeInTheDocument();
    expect(visualText(visual)).toContain('you are here');
  });

  it('renders nothing for an unknown or malformed visual', () => {
    const { container } = render(<VisualRenderer visual={{ type: 'pie', slices: [1] }} />);
    expect(container).toBeEmptyDOMElement();
    const { container: c2 } = render(<VisualRenderer visual={{ type: 'flow', stages: [] }} />);
    expect(c2).toBeEmptyDOMElement();
  });

  it('gives key facts an sr-only text', () => {
    render(<VisualRenderer visual={{ type: 'keyFacts', facts: [{ k: 'When', v: 'Within 30 days' }, { k: 'Where', v: 'FIRMS' }] }} />);
    expect(screen.getByText('When: Within 30 days. Where: FIRMS.')).toHaveClass('sr-only');
  });
});

describe('role gating', () => {
  it.each(['manager', 'intern'])('shows no launcher and no panel for %s', (r) => {
    role = r;
    render(wrap(<AskShellMount userRole={r}><AskLauncher /></AskShellMount>));
    expect(screen.queryByRole('button', { name: /ask vcfo/i })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Ask VCFO' })).toBeNull();
  });

  it.each(['client', 'admin', 'super_admin'])('shows the launcher for %s', (r) => {
    role = r;
    render(wrap(<AskShellMount userRole={r}><AskLauncher /></AskShellMount>));
    expect(screen.getByRole('button', { name: /ask vcfo/i })).toBeInTheDocument();
  });
});

describe('keyboard', () => {
  it('recognises ⌘J and Ctrl+J only', () => {
    const k = (over: Partial<KeyboardEvent>) =>
      isAskShortcut({ key: 'j', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...over });
    expect(k({ metaKey: true })).toBe(true);
    expect(k({ ctrlKey: true })).toBe(true);
    expect(k({ ctrlKey: true, key: 'J' })).toBe(true);
    expect(k({})).toBe(false);
    expect(k({ ctrlKey: true, shiftKey: true })).toBe(false);
    expect(k({ ctrlKey: true, key: 'k' })).toBe(false);
  });

  it('Ctrl+J opens the panel and Esc closes it', async () => {
    render(wrap(<AskShellMount userRole="client"><AskLauncher /></AskShellMount>));
    const launcher = screen.getByRole('button', { name: /ask vcfo/i });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('complementary', { name: 'Ask VCFO' })).toBeInTheDocument();
    expect(screen.getByText('What is GST, and do we need it?')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
  });
});
