"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { LazyMotion, domMax } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { applyAppearanceAttributes } from "@/lib/ui/table-prefs";
import { HotToaster } from "@/components/ui/hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";

const ComposeOutgoingEmailHost = dynamic(
  () =>
    import("@/components/email/ComposeOutgoingEmailHost").then((mod) => ({
      default: mod.ComposeOutgoingEmailHost,
    })),
  { ssr: false },
);

export function Providers({ children }: { children: ReactNode }) {
  // The person's density and text size (Profile > Appearance) go on <html> once per load.
  useEffect(() => applyAppearanceAttributes(), []);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchIntervalInBackground: false,
            retry: (failureCount, error) => {
              const msg = error instanceof Error ? error.message.toLowerCase() : '';
              if (msg.includes('unauthorized') || msg.includes('forbidden')) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domMax} strict>
        <TooltipProvider>
          <HotToaster />
          <AppProvider>
            {children}
            <ComposeOutgoingEmailHost />
          </AppProvider>
        </TooltipProvider>
      </LazyMotion>
    </QueryClientProvider>
    </SessionProvider>
    </ThemeProvider>
  );
}
