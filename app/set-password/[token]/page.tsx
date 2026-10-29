import { pageMetadata } from '@/lib/shell/page-metadata';
import { SetPasswordPage } from '@/components/client-portal/pages/team/SetPasswordPage';

export const metadata = pageMetadata('Set your password', 'Choose a password for VCFO Suite');

/** C-899: an invited client opens the link from the invite email and chooses a password. */
export default function SetPassword() {
  return <SetPasswordPage />;
}
