import { redirect } from 'next/navigation';

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Intern", "Intern home");


export default function InternHomePage() {
  redirect('/app/intern/today');
}
