"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { LazyMotion, domMax } from "framer-motion";
import { useState, type ReactNode } from "react";
import { HotToaster } from "@/components/ui/hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { ComposeOutgoingEmailHost } from "@/components/email/ComposeOutgoingEmailHost";
import { featureRegistry } from "@/components/_feature-registry";
import { uiRegistry } from "@/components/ui/_registry";

/** Dev-only anchor so registry symbols stay referenced. */
if (process.env.NODE_ENV === "development") {
  void featureRegistry;
  void uiRegistry;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
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
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
    <SessionProvider>
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domMax}>
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
