import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

/** One face for the interface (VCFO Spectrum, R-28): Roboto 400, 500 and 700. --font-serif,
 *  the legacy display hook, aliases --font-sans in globals.css until the .serif call sites move. */
const fontSans = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

/** Identifiers only: CIN, PAN, DIN, GSTIN, SRN, step and form codes. */
const fontMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VCFO Suite",
  description: "VCFO Suite — compliance cockpit for GCC setup, filings, and client collaboration.",
  icons: {
    icon: [{ url: "/vcfo-mark.png", type: "image/png" }],
    apple: [{ url: "/vcfo-mark.png", type: "image/png" }],
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
