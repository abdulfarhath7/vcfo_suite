'use client';

import { LandingCta } from './sections/LandingCta';
import { LandingHero } from './sections/LandingHero';
import { LandingHowItWorks } from './sections/LandingHowItWorks';
import { LandingImpact } from './sections/LandingImpact';
import { LandingProblem } from './sections/LandingProblem';
import { LandingRoles } from './sections/LandingRoles';

export function LandingPage() {
  return (
    <>
      <LandingHero />
      <LandingImpact />
      <LandingProblem />
      <LandingHowItWorks />
      <LandingRoles />
      <LandingCta />
    </>
  );
}
