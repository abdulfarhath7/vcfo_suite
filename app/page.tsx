import { MarketingShell } from '@/components/marketing/MarketingShell';
import { LandingPage } from '@/components/marketing/LandingPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata(
  'Home',
  'VCFO Suite — compliance cockpit for GCC setup, filings, and client collaboration for Indian professional services firms.',
);

export default function HomePage() {
  return (
    <MarketingShell>
      <LandingPage />
    </MarketingShell>
  );
}
