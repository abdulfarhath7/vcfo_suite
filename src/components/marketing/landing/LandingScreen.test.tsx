import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LandingScreen } from './LandingScreen';
import { COMPARE, COMPARE_COLS, DEMO_HREF, GUIDE, SIGN_IN_HREF } from './content';

// jsdom has no element scrolling; the Ask VCFO log scrolls to its last message.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

// Reduced motion skips the logo reveal (which needs real layout and fonts) and shows every section at once.
const realMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    ...realMatchMedia(query),
    matches: query.includes('prefers-reduced-motion: reduce'),
  })) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('LandingScreen', () => {
  it('sends sign-in to the real login page and book-a-demo to the contact page', () => {
    const { container } = render(<LandingScreen />);
    const signIn = screen.getAllByRole('link', { name: 'Sign in' });
    expect(signIn.length).toBeGreaterThan(0);
    signIn.forEach((a) => expect(a).toHaveAttribute('href', SIGN_IN_HREF));
    const demo = screen.getAllByRole('link', { name: /Book a demo/ });
    expect(demo.length).toBeGreaterThan(0);
    demo.forEach((a) => expect(a).toHaveAttribute('href', DEMO_HREF));
    // The prototype's click-through to demo portals is not ported.
    expect(container.querySelector('[data-app]')).toBeNull();
    expect(container.querySelector('a[href^="/client"], a[href^="/lead"], a[href^="/sign-in"]')).toBeNull();
  });

  it('shows the comparison with six rows and three product columns', () => {
    render(<LandingScreen />);
    expect(
      screen.getByRole('heading', { name: 'Spreadsheets break when compliance stops being routine.' }),
    ).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'VCFO Suite compared with the old way' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(COMPARE.length + 1);
    expect(COMPARE).toHaveLength(6);
    expect(within(table).getByRole('img', { name: COMPARE_COLS[0] })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: COMPARE_COLS[1] })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: COMPARE_COLS[2] })).toBeInTheDocument();
    COMPARE.forEach((r) => expect(within(table).getByRole('rowheader', { name: r.label })).toBeInTheDocument());
  });

  it('switches the portal screenshot with the tabs', () => {
    render(<LandingScreen />);
    const lead = screen.getByRole('tab', { name: 'Project lead' });
    fireEvent.click(lead);
    expect(lead).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-lead');
  });

  it('answers a fixed Ask VCFO question without a link to a demo portal', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask VCFO' }));
    const panel = screen.getByRole('dialog', { name: 'Ask VCFO' });
    fireEvent.click(within(panel).getByRole('button', { name: GUIDE[0].q }));
    expect(within(panel).getByText(GUIDE[0].a)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Show me' })).toBeInTheDocument();
    expect(within(panel).queryByText('Open the screen')).toBeNull();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Ask VCFO' })).toBeNull();
  });
});
