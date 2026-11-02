import { redirect } from 'next/navigation';
import { settingsHrefFromProfile } from '@/components/console/pages/insight/profile-redirect';

/**
 * Old-shell Profile (prototype /{role}/profile). The console keeps profile, security, Outlook and
 * appearance on its Settings page, so this address only forwards there; `?tab=` becomes `?section=`.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  redirect(settingsHrefFromProfile('/app/manager', tab));
}
