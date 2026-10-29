'use client';

import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { SkeletonRows } from '@/components/ui/empty-state';
import { SuperPageError } from '@/components/super/parts/super-parts';
import { useApp } from '@/context/AppContext';
import { isFirmWideAdmin } from '@/lib/auth';
import { useFirmSettings } from './use-firm-settings';
import {
  BrandingSection,
  FirmProfileSection,
  ReminderSection,
  SettingsHistorySection,
  WorkingCalendarSection,
} from './sections';

/**
 * FIRM SETTINGS (G-02, prototype `super/SettingsScreen`) — one store for the firm's name,
 * logo, contact details, timezone, working days, holidays and default reminder days.
 *
 * Shown to the super admin (under Firm settings) and to firm admins
 * (`/app/admin/firm-settings`). Every change saves through `/api/firm-settings`, which writes
 * an audit event per field, and the settings history reads those events back. The prototype's
 * people, roles, service targets and integrations cards are not here: People owns people and
 * roles, and the rest have no store.
 */
export function FirmSettingsBody() {
  const { user } = useApp();
  const canEdit = isFirmWideAdmin(user?.role);
  const { query, settings, history, save, uploadLogo, removeLogo, logoSrc } = useFirmSettings();

  if (query.isPending) return <SkeletonRows rows={8} />;
  if (query.isError || !settings) {
    return <SuperPageError title="Firm settings could not load" error={query.error} onRetry={() => void query.refetch()} />;
  }

  const onSave = (patch: Parameters<typeof save.mutate>[0]) => save.mutate(patch);

  return (
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <FirmProfileSection key={settings.updatedAt ?? 'new'} settings={settings} canEdit={canEdit} save={onSave} saving={save.isPending} />
        <WorkingCalendarSection settings={settings} canEdit={canEdit} save={onSave} />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <BrandingSection settings={settings} canEdit={canEdit} logoSrc={logoSrc} uploadLogo={uploadLogo} removeLogo={removeLogo} />
        <ReminderSection settings={settings} canEdit={canEdit} save={onSave} />
        {canEdit ? <SettingsHistorySection rows={history} /> : null}
      </div>
    </div>
  );
}

/** The page form for `/app/admin/firm-settings`: a plain head over the body. */
export default function FirmSettings({ path }: { path: string }) {
  return (
    <PageTransition>
      <SEO title="Firm settings — VCFO Suite" description="The firm's profile, calendar, branding and reminders." path={path} />
      <div className="flex flex-col gap-4">
        <h1 className="text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink">Firm settings</h1>
        <FirmSettingsBody />
      </div>
    </PageTransition>
  );
}
