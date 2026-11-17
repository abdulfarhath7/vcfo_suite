import { pageMetadata } from '@/lib/shell/page-metadata';
import { publicReceivablesMetadata } from '@/views/receivables/client/public-metadata';
import { AccountPage } from '@/views/receivables/partner/AccountPage';
import { partnerPageGuard } from '../_partner-guard';
import { receivablesExternal } from '@/lib/receivables/external';
import { notFound } from 'next/navigation';

export const metadata = { ...publicReceivablesMetadata, ...pageMetadata('My account', 'Your receivables login') };
export const dynamic = 'force-dynamic';

/** /receivables/account — the client partner's name, email, update emails, password and Log out. */
export default async function ReceivablesAccountPage() {
  // Receivables v2: partner-facing, off unless RECEIVABLES_EXTERNAL=on.
  if (!receivablesExternal()) notFound();
  await partnerPageGuard('/receivables/account');
  return <AccountPage />;
}
