'use client';

/**
 * Team — prototype s/team/team_redesign.dc.html (+ team_invite, team_handoff),
 * restyled to VCFO Spectrum. C-0027 moves Team into Profile as one section; this
 * route stays and shows the same `TeamSection` the Settings page uses.
 */
import { TeamSection } from './team-sections';
import '../../css/team-00-contract.css';
import '../../css/team-team.css';

export function TeamPage() {
  return (
    <div className="cp-team">
      <main className="pg tb-wrap tp-team">
        <TeamSection />
      </main>
    </div>
  );
}
