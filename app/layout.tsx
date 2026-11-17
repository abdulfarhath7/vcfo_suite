import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

/** One face for the interface (VCFO Spectrum, R-28): Roboto 400, 500 and 700. --font-serif,
 *  the legacy display hook, aliases --font-sans in globals.css until the .serif call sites move. */
/* The font files live in public/fonts (latin subset), so a build never downloads from Google
   Fonts; two Docker builds failed on that download (17 Nov 2026). */
const fontSans = localFont({
  src: [
    { path: "../public/fonts/roboto-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/roboto-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/roboto-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

/** Identifiers only: CIN, PAN, DIN, GSTIN, SRN, step and form codes. */
const fontMono = localFont({
  src: [{ path: "../public/fonts/roboto-mono-500-latin.woff2", weight: "500", style: "normal" }],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VCFO Suite",
  description: "VCFO Suite — compliance cockpit for GCC setup, filings, and client collaboration.",
  icons: {
    icon: [
      { url: "/logo-mark.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className={`${fontSans.className} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
