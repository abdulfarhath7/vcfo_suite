'use client';

/**
 * Route entries for /app/client/registrations and /app/client/registrations/[id]. Inside the
 * client portal shell they render the Spectrum pages; outside it (a super admin on the staff
 * AppShell) they send the viewer to the incorporation registration phase, which already
 * lists the same steps.
 */
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePortalOptional } from '../../PortalProvider';
import { phaseHref } from '../../routes';
import { RegistrationsList } from './RegistrationsPage';
import { RegistrationRecordPage } from './RegistrationPage';

function useStaffRedirect(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (active) router.replace(phaseHref(4));
  }, [active, router]);
}

export function ClientRegistrationsRoute() {
  const portal = usePortalOptional();
  useStaffRedirect(!portal);
  if (!portal) return null;
  return <RegistrationsList />;
}

export function ClientRegistrationRoute() {
  const portal = usePortalOptional();
  const params = useParams<{ id: string }>();
  useStaffRedirect(!portal);
  if (!portal) return null;
  return <RegistrationRecordPage id={decodeURIComponent(String(params?.id ?? ''))} />;
}
