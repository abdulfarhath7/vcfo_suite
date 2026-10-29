/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashHero, DashHeroCompanyTile, DashHeroStage } from './DashHero';
import { formatClientNowLabel } from '@/hooks/use-client-locale-date';

vi.mock('next/navigation', () => ({ usePathname: () => '/app/manager/dashboard', useRouter: () => ({ push: vi.fn() }) }));

describe('DashHero (H3c)', () => {
  it('draws one compact tile per stat with the note, and links tiles with href', () => {
    render(
      <DashHero
        title="Good morning, Asha"
        stats={[
          { label: 'Overdue', value: 3, hot: true, sub: '2 clients', href: '/app/intern/tasks?focus=overdue' },
          { label: 'Due this week', value: 7, note: '3 new' },
        ]}
      >
        <button type="button">New project</button>
      </DashHero>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Asha' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Overdue: 3, 2 clients. Open the list' });
    expect(link).toHaveAttribute('href', '/app/intern/tasks?focus=overdue');
    expect(screen.getByText('3')).toHaveClass('text-danger');
    expect(screen.getByText('3 new')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument();
  });

  it('draws a trend line only when a tile has one', () => {
    const { container } = render(
      <DashHero title="Overview" stats={[{ label: 'Filed', value: 12, good: true, trend: [2, 4, 3, 6] }, { label: 'Open', value: 4 }]} />,
    );
    expect(container.querySelectorAll('svg polyline')).toHaveLength(1);
  });

  it('turns the ring into one more tile, unless a stat repeats it', () => {
    const { rerender } = render(<DashHero title="Overview" stats={[{ label: 'Clients', value: 9 }]} ring={{ value: 6, caption: 'on track' }} />);
    expect(screen.getByText('On track')).toBeInTheDocument();
    rerender(<DashHero title="Overview" stats={[{ label: 'On track', value: 6 }]} ring={{ value: 6, caption: 'on track' }} />);
    expect(screen.getAllByText('On track')).toHaveLength(1);
  });

  it('makes a tile with how focusable for its info card', () => {
    render(<DashHero title="Overview" stats={[{ label: 'Waiting', value: 2, how: 'Steps waiting on the client today.' }]} />);
    expect(screen.getByText('Waiting').closest('[tabindex="0"]')).not.toBeNull();
  });

  it('shows the client company tile, stage and steps in place of the date line', () => {
    render(
      <DashHero
        title="Northwind"
        lead={<DashHeroCompanyTile name="Northwind India Private Limited" />}
        stage={<span>Incorporating</span>}
        steps="6 of 25 steps"
        stats={[{ label: 'Needs from you', value: 2 }]}
      />,
    );
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('Incorporating')).toBeInTheDocument();
    expect(screen.getByText('6 of 25 steps')).toBeInTheDocument();
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('has no settings button; the settings live in Profile > Appearance', () => {
    render(<DashHero title="Good morning, Asha" stats={[{ label: 'Overdue', value: 1 }]} />);
    expect(screen.queryByRole('button', { name: 'Greeting card settings' })).toBeNull();
  });

  it('shows the small text after the number', () => {
    render(<DashHero title="Overview" stats={[{ label: 'Filed', value: 4, of: '/ 6' }]} />);
    expect(screen.getByText('/ 6')).toBeInTheDocument();
  });

  it('draws the stage tag without a dot', () => {
    render(<DashHeroStage tone="done">Incorporated</DashHeroStage>);
    expect(screen.getByText('Incorporated')).toHaveClass('bg-positive-soft');
  });

  it('writes the date as "Thu 29 Oct 2026 · 12:31 PM" in IST', () => {
    expect(formatClientNowLabel(new Date('2026-10-29T07:01:00Z'))).toBe('Thu 29 Oct 2026 · 12:31 PM');
  });
});
