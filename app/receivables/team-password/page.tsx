import { pageMetadata } from '@/lib/shell/page-metadata';
import { SetPasswordPage } from '@/components/client-portal/pages/team/SetPasswordPage';

export const metadata = pageMetadata('Set your password', 'Choose a password for your receivables login');

/**
 * A receivables team member opens the link from the "you were added" email
 * (`/receivables/team-password?token=…`), chooses a password and signs in at `/login`.
 */
export default async function ReceivablesTeamPassword({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).token;
  return (
    <SetPasswordPage
      token={typeof raw === 'string' ? raw : ''}
      apiPath="/api/public/receivables/team-password"
      loginPath="/login"
      invalidText="This link was used already or has expired. Ask your team to add you again."
    />
  );
}
