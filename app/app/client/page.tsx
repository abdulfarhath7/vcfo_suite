import { redirect } from 'next/navigation';

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Client portal", "Client home");

/** The client landing is the Overview dashboard (see docs/CLIENT-DASHBOARD-CONTEXT.md §2). */
export default function ClientHomePage() {
  redirect('/app/client/overview');
}
