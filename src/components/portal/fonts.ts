import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

/**
 * The prototype's three typefaces, self-hosted by next/font (no request to Google at runtime).
 * The CSS variables are read by `css-src/90-bridge.css` (--f-disp, --f-body, --f-mono).
 * Imported by the client layout (a server component) and applied to the portal root.
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const PORTAL_FONT_VARS = `${archivo.variable} ${plexSans.variable} ${plexMono.variable}`;
