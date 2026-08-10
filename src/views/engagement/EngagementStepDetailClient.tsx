"use client";

import dynamic from "next/dynamic";
import { AuthBootScreen } from "@/components/common/AuthBootScreen";

const EngagementStepDetail = dynamic(() => import("@/views/engagement/EngagementStepDetail"), {
  ssr: false,
  loading: () => <AuthBootScreen label="Loading checklist step…" />,
});

/** Client-only entry — matches engagement detail; avoids SSR/param races on step routes. */
export default function EngagementStepDetailClient() {
  return <EngagementStepDetail />;
}
