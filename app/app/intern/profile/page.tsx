import AccountSettings from '@/views/settings/AccountSettings';

/* Profile (prototype /{role}/profile). The same view as Settings; `?tab=` picks the section. */
export default function Page() {
  return <AccountSettings path="/app/intern/profile" />;
}
