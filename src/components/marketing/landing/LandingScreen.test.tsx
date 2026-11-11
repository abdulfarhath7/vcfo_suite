import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LandingScreen } from './LandingScreen';
import { COMPARE, COMPARE_COLS, GUIDE, SIGN_IN_HREF } from './content';

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
  it('sends sign-in to the real login page and opens Book a demo as a dialog', () => {
    const { container } = render(<LandingScreen />);
    const signIn = screen.getAllByRole('link', { name: 'Sign in' });
    expect(signIn.length).toBeGreaterThan(0);
    signIn.forEach((a) => expect(a).toHaveAttribute('href', SIGN_IN_HREF));
    expect(screen.queryByRole('link', { name: /^Book a demo/ })).not.toHaveAttribute('href', '/contact');
    const demo = screen.getAllByRole('button', { name: /^Book a demo$/ });
    expect(demo.length).toBeGreaterThan(2);
    fireEvent.click(demo[0]);
    const dialog = screen.getByRole('dialog', { name: 'Book a demo' });
    expect(within(dialog).getByLabelText('Name')).toBeRequired();
    expect(within(dialog).getByLabelText('Firm')).toBeRequired();
    expect(within(dialog).getByLabelText('Work email')).toBeRequired();
    // No link goes to a demo portal: the real tool has none.
    expect(container.querySelector('a[href^="/client"], a[href^="/lead"], a[href^="/sign-in"]')).toBeNull();
  });

  it('opens Book a demo from a click-through item, by click and by Enter', () => {
    const { container } = render(<LandingScreen />);
    const items = container.querySelectorAll('[data-app]');
    expect(items.length).toBeGreaterThan(5);
    fireEvent.click(items[0]!);
    expect(screen.getByRole('dialog', { name: 'Book a demo' })).toBeInTheDocument();
  });

  it('LP-02: shows no screenshot of the app, only the logo and abstract art', () => {
    const { container } = render(<LandingScreen />);
    const images = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    // LP-01: the logo file for each theme; nothing else is an image.
    expect(images.every((src) => src === '/landing/vcfo-logo-on-black.webp' || src === '/landing/vcfo-logo-on-white.webp')).toBe(true);
    expect(container.querySelector('svg.hero-art')).not.toBeNull();
    expect(container.querySelector('#portals, #incorporate, #register, #ask')).toBeNull();
    expect(container.textContent).not.toMatch(/every screen on this page is a real one/i);
  });

  it('LP-01: the theme toggle switches to dark and back, and remembers the choice', () => {
    render(<LandingScreen />);
    const toggle = screen.getByRole('button', { name: 'Use the dark theme' });
    fireEvent.click(toggle);
    expect(document.documentElement.dataset.lpTheme).toBe('dark');
    expect(localStorage.getItem('vcfo.lp-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Use the light theme' }));
    expect(document.documentElement.dataset.lpTheme).toBeUndefined();
    expect(localStorage.getItem('vcfo.lp-theme')).toBe('light');
  });

  it('LP-03: one hero scene per headline word, the first one showing', () => {
    const { container } = render(<LandingScreen />);
    const scenes = [...container.querySelectorAll('svg.hero-art [data-scene]')].map((g) => g.getAttribute('data-scene'));
    expect(scenes).toEqual(['compliance', 'incorporation', 'registration']);
    expect(container.querySelector('svg.hero-art .is-active')?.getAttribute('data-scene')).toBe('compliance');
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
