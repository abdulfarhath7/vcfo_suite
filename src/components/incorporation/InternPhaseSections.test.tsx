import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InternPhaseSections } from '@/components/incorporation/InternOverviewProgress';
import { internEngagementOpenPhasesStorageKey } from '@/lib/intern/intern-overview-progress';

const PHASES = [
  { id: 'pre-inc-phase-1', title: 'Name application', label: 'Name application', done: 5, total: 5, range: 'Steps 1–5' },
  { id: 'pre-inc-phase-2', title: 'Incorporation', label: 'Incorporation', done: 3, total: 9, range: 'Steps 6–14' },
  { id: 'post-inc-phase-3', title: 'Post-incorporation', label: 'Post-incorporation', done: 0, total: 11, range: 'Steps 15–25' },
  { id: 'registration-phase-4', title: 'Registrations', label: 'Registrations', done: 0, total: 23, range: 'Reg-1–23' },
];

function renderSections(openPhaseId?: string) {
  return render(
    <InternPhaseSections
      engagementId="eng-1"
      currentPhaseId="pre-inc-phase-2"
      phases={PHASES}
      openPhaseId={openPhaseId}
    >
      {(phaseId) => <p>steps of {phaseId}</p>}
    </InternPhaseSections>,
  );
}

/** A section header: the button named after its phase, which carries `aria-expanded`. */
const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('InternPhaseSections', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('has no phase track and opens only the current phase at first', () => {
    renderSections();
    expect(screen.queryByRole('group', { name: 'Phases' })).toBeNull();
    expect(screen.getByText('steps of pre-inc-phase-2')).toBeInTheDocument();
    expect(screen.queryByText('steps of pre-inc-phase-1')).toBeNull();
    expect(header('Incorporation')).toHaveAttribute('aria-expanded', 'true');
    expect(header('Name application')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getAllByText('Not started')).toHaveLength(2);
  });

  it('follows the current phase when it settles after the card mounts', () => {
    const view = render(
      <InternPhaseSections engagementId="eng-1" currentPhaseId="pre-inc-phase-1" phases={PHASES}>
        {(phaseId) => <p>steps of {phaseId}</p>}
      </InternPhaseSections>,
    );
    expect(screen.getByText('steps of pre-inc-phase-1')).toBeInTheDocument();
    view.rerender(
      <InternPhaseSections engagementId="eng-1" currentPhaseId="pre-inc-phase-2" phases={PHASES}>
        {(phaseId) => <p>steps of {phaseId}</p>}
      </InternPhaseSections>,
    );
    expect(screen.getByText('steps of pre-inc-phase-2')).toBeInTheDocument();
    expect(screen.queryByText('steps of pre-inc-phase-1')).toBeNull();
  });

  it('toggles a section and remembers the open sections per engagement', () => {
    renderSections();
    fireEvent.click(header('Name application'));
    expect(screen.getByText('steps of pre-inc-phase-1')).toBeInTheDocument();
    expect(window.localStorage.getItem(internEngagementOpenPhasesStorageKey('eng-1'))).toBe(
      'pre-inc-phase-1,pre-inc-phase-2',
    );
  });

  it('expands and collapses every section from the card head', () => {
    renderSections();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    for (const phase of PHASES) expect(screen.getByText(`steps of ${phase.id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(window.localStorage.getItem(internEngagementOpenPhasesStorageKey('eng-1'))).toBe('');
  });

  it('opens the phase named by ?phase= on top of the stored sections and scrolls to it', () => {
    window.localStorage.setItem(internEngagementOpenPhasesStorageKey('eng-1'), 'pre-inc-phase-1');
    renderSections('post-inc-phase-3');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText('steps of pre-inc-phase-1')).toBeInTheDocument();
    expect(screen.getByText('steps of post-inc-phase-3')).toBeInTheDocument();
    expect(screen.queryByText('steps of pre-inc-phase-2')).toBeNull();
  });
});
