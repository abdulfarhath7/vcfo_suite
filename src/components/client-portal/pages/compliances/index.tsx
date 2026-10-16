'use client';

/**
 * Route entries for /app/client/compliances/{calendar,filings}. Inside the
 * client portal shell they render the v7 pages; a super admin viewing the
 * client segment keeps the staff AppShell, so the shared staff views
 * (src/views/compliances/CompliancePages.tsx) render there instead.
 */
import { usePortalOptional } from '../../PortalProvider';
import { ComplianceCalendarPage, FilingsPage } from '@/views/compliances/CompliancePages';
import { CompliancesCalendar } from './CalendarPage';
import { CompliancesFilings } from './FilingsPage';

export function ClientCompliancesCalendarRoute() {
  const portal = usePortalOptional();
  if (!portal) return <ComplianceCalendarPage basePath="/app/client/compliances" />;
  return <CompliancesCalendar />;
}

export function ClientCompliancesFilingsRoute() {
  const portal = usePortalOptional();
  if (!portal) return <FilingsPage basePath="/app/client/compliances" />;
  return <CompliancesFilings />;
}
