import { redirect } from 'next/navigation';
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Compliances", "Compliance calendar and filings");

/** Compliances is a group now — the calendar is its landing child. */
export default function Page() {
  redirect('/app/client/compliances/calendar');
}
