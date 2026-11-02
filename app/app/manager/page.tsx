import { redirect } from 'next/navigation';

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Admin", "Admin home");


export default function AdminHomePage() {
  redirect('/app/manager/dashboard');
}
