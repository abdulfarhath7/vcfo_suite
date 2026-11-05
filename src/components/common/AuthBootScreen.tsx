"use client";

import { useEffect } from "react";
import { LoadingScreen } from "@/components/common/LoadingScreen";

/** When the boot screen last reloaded the page (sessionStorage), so it never reloads in a loop. */
const RELOAD_STAMP_KEY = "vcfo:boot-reload-at";
const RELOAD_AT_MOST_EVERY_MS = 60_000;

/**
 * The screen the shells show until the signed-in user is known.
 *
 * Safety net (2026-11-04): on the live site this screen could stay up after sign-in until the
 * person refreshed by hand. If it is still showing after `reloadAfterMs`, the page reloads once
 * (at most once a minute), which reads the session again from the cookie. Pass 0 to turn it off,
 * as the code-split loaders do.
 */
export function AuthBootScreen({
  label = "Opening VCFO Suite…",
  reloadAfterMs = 8000,
}: {
  label?: string;
  reloadAfterMs?: number;
}) {
  useEffect(() => {
    if (!reloadAfterMs) return;
    const timer = window.setTimeout(() => {
      try {
        const last = Number(window.sessionStorage.getItem(RELOAD_STAMP_KEY) ?? 0);
        if (Date.now() - last < RELOAD_AT_MOST_EVERY_MS) return;
        window.sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
      } catch {
        // No sessionStorage (private mode): reload anyway; the timer only runs while stuck.
      }
      window.location.reload();
    }, reloadAfterMs);
    return () => window.clearTimeout(timer);
  }, [reloadAfterMs]);

  return <LoadingScreen message={label} />;
}
