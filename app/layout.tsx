import type { Metadata } from "next";
import { Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

/** One face for display and body (docs/design/TOKENS.md). --font-serif, the legacy
 *  display hook, aliases --font-sans in globals.css until the .serif call sites move. */
const fontSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

/** Identifiers only: CIN, PAN, DIN, GSTIN, file names, codes. */
const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className={`${fontSans.className} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
