import { redirect } from 'next/navigation';

/** Legacy route — the filing tracker is now Compliances → Filings. */
export default function Page() {
  redirect('/app/admin/compliances/filings');
}
