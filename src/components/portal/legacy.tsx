'use client';

/**
 * What a super admin sees on /app/client/** (the staff AppShell, not the client
 * portal): the shared staff-style views those routes showed before the redesign.
 * Loaded lazily, so a client never downloads them.
 */
import dynamic from 'next/dynamic';

export const LegacyOverview = dynamic(() => import('@/views/client/Overview'), { ssr: false });
export const LegacyIncorporation = dynamic(() => import('@/views/client/Incorporation'), { ssr: false });
export const LegacyStep = dynamic(() => import('@/views/engagement/EngagementStepDetailClient'), { ssr: false });
export const LegacyBoard = dynamic(() => import('@/views/client/BoardResolutionView'), { ssr: false });
export const LegacyDocuments = dynamic(() => import('@/views/client/Documents'), { ssr: false });
export const LegacyLibrary = dynamic(() => import('@/views/client/ask/ClientLibrary'), { ssr: false });
export const LegacyCalendar = dynamic(
  () => import('@/views/compliances/CompliancePages').then((m) => () => <m.ComplianceCalendarPage basePath="/app/client/compliances" />),
  { ssr: false },
);
export const LegacyFilings = dynamic(
  () => import('@/views/compliances/CompliancePages').then((m) => () => <m.FilingsPage basePath="/app/client/compliances" />),
  { ssr: false },
);
