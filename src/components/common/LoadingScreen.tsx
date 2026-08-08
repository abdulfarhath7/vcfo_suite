"use client";

import { HexgridLoader } from "@/components/common/HexgridLoader";
import { SbcLogo } from "@/components/brand/SbcLogo";
import { Eyebrow } from "@/components/noir/Eyebrow";
import { GoldDivider } from "@/components/noir/GoldDivider";
import { GrainOverlay } from "@/components/noir/Grain";
import { Mono } from "@/components/noir/Mono";

export function LoadingScreen({ message = "Opening VCFO Suite…" }: { message?: string }) {
  return (
    <output
      className="loading-screen relative flex min-h-screen items-center justify-center bg-background px-6 py-12"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <GrainOverlay className="opacity-[0.18]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <header className="mb-10 flex flex-col items-center gap-4">
          <SbcLogo variant="mark" size={48} decorative={false} />
          <Eyebrow className="mb-0">Compliance cockpit</Eyebrow>
          <h1 className="serif display-md text-foreground">VCFO Suite</h1>
          <GoldDivider className="w-28" />
        </header>

        <HexgridLoader size="lg" silent />

        <div className="mt-10 flex w-full max-w-xs flex-col items-center gap-4">
          <Mono className="text-[13px] leading-snug text-foreground">{message}</Mono>
          <progress
            className="loading-progress h-0.5 w-full overflow-hidden rounded-full bg-border [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[hsl(var(--hex-loader-primary)/0.55)] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[hsl(var(--hex-loader-primary)/0.55)]"
            aria-label="Loading"
          />
          <p className="text-[11px] leading-relaxed text-muted-paper">
            GCC setup · compliance filings · document vault
          </p>
        </div>
      </div>
    </output>
  );
}
