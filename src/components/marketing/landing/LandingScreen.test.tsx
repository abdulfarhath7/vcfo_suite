import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LandingScreen } from './LandingScreen';
import { ASK_A, ASK_Q, COMPARE, COMPARE_COLS, GUIDE, INC_STEPS, REGULATORS, SIGN_IN_HREF, busyWeeks, ringItems } from './content';

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
    expect(items.length).toBeGreaterThan(30);
    const hero = screen.getByRole('button', { name: 'Book a demo to see the incorporation screen' });
    fireEvent.click(hero);
    expect(screen.getByRole('dialog', { name: 'Book a demo' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Book a demo' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Book a demo' })).toBeNull();
    const chip = within(container).getByRole('button', { name: 'GST' });
    fireEvent.keyDown(chip, { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: 'Book a demo' })).toBeInTheDocument();
  });

  it('opens Book a demo from the portal screenshot and the Ask VCFO bubble, not a demo portal', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByRole('tabpanel'));
    expect(screen.getByRole('dialog', { name: 'Book a demo' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Book a demo' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Book a demo to try Ask VCFO' }));
    expect(screen.getByRole('dialog', { name: 'Book a demo' })).toBeInTheDocument();
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

  // v2 (R-53, the prototype's docs/LANDING-V2.md). T7: the landing tests, updated for the removed sections.
  describe('v2 structure', () => {
    it('has nine sections and no #record or #ask section; #journey survives as the stage rail', () => {
      const { container } = render(<LandingScreen />);
      const sections = container.querySelectorAll('main > section');
      expect(sections).toHaveLength(9);
      const ids = Array.from(sections).map((s) => s.id || s.className.split(' ')[0]);
      expect(ids).toEqual(['hero', 'incorporate', 'after', 'register', 'comply', 'compare', 'portals', 'trust', 'demo']);
      expect(container.querySelector('#record, #ask')).toBeNull();
      // Old links to /#journey (the marketing nav, /roles) still land on the journey, now inside #incorporate.
      expect(container.querySelector('#incorporate #journey')).not.toBeNull();
      // Every link on the page points at an id that exists.
      container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
        const id = a.getAttribute('href')!.slice(1);
        expect(container.querySelector(`#${id}`), a.getAttribute('href')!).not.toBeNull();
      });
      // The Ask guide's "Show me" targets all exist.
      GUIDE.forEach((g) => expect(container.querySelector(`#${g.sec}`), g.sec).not.toBeNull());
    });

    it('T1: the hero has its headline and exactly two buttons, Book a demo and Try it live (D11)', () => {
      const { container } = render(<LandingScreen />);
      const hero = container.querySelector('.hero') as HTMLElement;
      expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(/^Your complete .+ companion\.$/);
      const ctas = hero.querySelector('.hero-ctas') as HTMLElement;
      expect(Array.from(ctas.children).map((c) => c.textContent?.trim())).toEqual(['Book a demo', 'Try it live']);
      expect(within(hero).queryByText('See how it works')).toBeNull();
      // F3: the logo reveal does not play on load, so nothing hides the hero.
      expect(container.querySelector('.lp')).not.toHaveClass('pre-reveal');
      expect(container.querySelector('#reveal')).toBeNull();
    });

    it('R5: nothing is hidden or empty in the markup before script runs', () => {
      const { container } = render(<LandingScreen />);
      container.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
        expect(el.style.opacity, el.className).not.toBe('0');
        expect(el.style.visibility, el.className).not.toBe('hidden');
      });
      // The numbers are printed in full; the count-up only animates them.
      expect(Array.from(container.querySelectorAll('[data-count]')).map((n) => n.textContent)).toEqual(['25', '23', '6', '1']);
      // Pinned diagrams are complete at rest: every step lit, no group dimmed.
      expect(container.querySelector('[data-playing]')).toBeNull();
      expect(container.querySelector('.tk-label')).toHaveTextContent(/16 steps/i);
    });

    it('V1 and the pinned flow chart: 16 steps in order and the NOC decision inside the chart', () => {
      const { container } = render(<LandingScreen />);
      const chart = container.querySelector('#incorporate svg.swim') as SVGElement;
      const ticks = chart.querySelectorAll('.tk');
      expect(ticks).toHaveLength(16);
      expect(INC_STEPS).toHaveLength(16);
      expect(ticks[0].querySelector('title')).toHaveTextContent('Step 1: Client details');
      expect(ticks[15].querySelector('title')).toHaveTextContent('Step 16: Certificate of Incorporation');
      const noc = chart.querySelector('.sg.noc') as SVGElement;
      expect(Array.from(noc.querySelectorAll('text')).map((t) => t.textContent)).toEqual(['NOC CHECK', 'Ownership', 'Subsidiary', 'Foreign subsidiary', 'NOC']);
      // D2: the step list beside the chart is gone.
      expect(container.querySelector('.story-step')).toBeNull();
      expect(container.querySelector('#incorporate')).toHaveAttribute('data-pin', 'story');
      expect(container.querySelector('#comply')).toHaveAttribute('data-pin', 'ring');
    });

    it('V2: the hero chip reads Done under reduced motion; V3: the ribbon names six regulators', () => {
      render(<LandingScreen />);
      const chip = document.querySelector('.status-chip') as HTMLElement;
      expect(chip).toHaveTextContent('Name approval');
      expect(chip).toHaveTextContent('Done');
      const ribbon = screen.getByRole('list', { name: 'Six regulators on one calendar' });
      expect(within(ribbon).getAllByRole('listitem').map((li) => li.textContent)).toEqual(REGULATORS.map((r) => r.name));
    });

    it('V4 and V5: the filing windows under the 180-day line and the busy weeks beside the ring', () => {
      const { container } = render(<LandingScreen />);
      expect(container.querySelectorAll('#after .gantt .g-row')).toHaveLength(4);
      const heat = container.querySelector('#comply .heat') as HTMLElement;
      expect(heat.querySelectorAll('.heat-col')).toHaveLength(12);
      expect(heat.querySelectorAll('.heat-cell')).toHaveLength(60);
      // The heat map counts the ring's own statutory dates, nothing more.
      expect(busyWeeks().flat().reduce((a, b) => a + b, 0)).toBe(ringItems().length);
      // D7: one ring label; D5: one portal screenshot in #comply.
      expect(container.querySelector('#comply .ctr-l')).toHaveTextContent('each filing: owner · date · proof');
      expect(container.querySelectorAll('#comply img')).toHaveLength(1);
    });

    it('D8: the Ask VCFO bubble on the client screenshot holds the whole answer', () => {
      render(<LandingScreen />);
      const bubble = screen.getByRole('button', { name: 'Book a demo to try Ask VCFO' });
      expect(bubble).toHaveTextContent(ASK_Q);
      expect(within(bubble).getByText(ASK_A, { selector: '.sr' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Manager' }));
      expect(screen.queryByRole('button', { name: 'Book a demo to try Ask VCFO' })).toBeNull();
    });

    it('D10 and the trust row: four trust tiles and four closed questions', () => {
      const { container } = render(<LandingScreen />);
      expect(container.querySelectorAll('#trust .trust > .card')).toHaveLength(4);
      const faq = container.querySelector('#faq') as HTMLElement;
      const qs = Array.from(faq.querySelectorAll('details'));
      expect(qs.map((d) => d.querySelector('summary')?.textContent)).toEqual([
        'Who is VCFO Suite for?',
        'What does the client do in the portal?',
        'Which filings does the calendar cover?',
        'Where is the data held, and who can see it?',
      ]);
      qs.forEach((d) => expect(d).not.toHaveAttribute('open'));
      expect(within(faq).queryByText(/only for SBC/)).toBeNull();
      expect(within(faq).queryByText(/How are we reminded/)).toBeNull();
    });

    it('R2: no paragraph in a section runs past one sentence', () => {
      const { container } = render(<LandingScreen />);
      container.querySelectorAll<HTMLElement>('main section .body, main section .lead, main section .tab-desc').forEach((p) => {
        const sentences = (p.textContent ?? '').split(/(?<=[.?!])\s+(?=[A-Z])/).filter(Boolean);
        expect(sentences, p.textContent ?? '').toHaveLength(1);
      });
    });

    it('replays the logo reveal only on a click on the nav logo, never under reduced motion', () => {
      const { container } = render(<LandingScreen />);
      act(() => {
        fireEvent.click(container.querySelector('.nav-logo') as HTMLElement);
      });
      expect(container.querySelector('#reveal')).toBeNull();
      expect(container.querySelector('.lp')).not.toHaveClass('pre-reveal');
    });
  });
});
