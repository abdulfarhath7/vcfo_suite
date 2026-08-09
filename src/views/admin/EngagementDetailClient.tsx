"use client";

import dynamic from "next/dynamic";
import { AuthBootScreen } from "@/components/common/AuthBootScreen";

const EngagementDetail = dynamic(() => import("@/views/admin/EngagementDetail"), {
  ssr: false,
  loading: () => <AuthBootScreen label="Loading project workspace…" />,
});

/** Client-only entry — avoids SSR crashes on slug engagement routes in production. */
export default function EngagementDetailClient() {
  return <EngagementDetail />;
}
