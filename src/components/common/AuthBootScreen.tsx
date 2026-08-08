"use client";

import { LoadingScreen } from "@/components/common/LoadingScreen";

export function AuthBootScreen({ label = "Opening VCFO Suite…" }: { label?: string }) {
  return <LoadingScreen message={label} />;
}
