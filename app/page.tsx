import type { Metadata } from 'next';
import { IBM_Plex_Mono, Poppins } from 'next/font/google';
import localFont from 'next/font/local';
import { LandingPage } from '@/components/marketing/LandingPage';

// The landing keeps the old v6 type: Public Sans for text, IBM Plex Mono for labels, Poppins for the logo reveal only.
// The variables are scoped to the landing root; the portals keep Roboto from app/layout.tsx.
// Public Sans is the file the v6 landing embedded: the current Google build sets about 3% wider and moves line breaks.
const sans = localFont({
  src: '../public/landing/public-sans.woff2',
  weight: '400 600',
  variable: '--lp-sans',
  display: 'swap',
});
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--lp-mono', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '700'], variable: '--lp-poppins', display: 'swap' });

const TITLE = 'VCFO Suite: your complete compliance companion';
const DESCRIPTION =
  'VCFO Suite: your complete compliance companion. Incorporation, registrations and the statutory calendar for India companies, on one record shared by the firm and the client.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

export default function HomePage() {
  return <LandingPage fontClass={`${sans.variable} ${mono.variable} ${poppins.variable}`} />;
}
