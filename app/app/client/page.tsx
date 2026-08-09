import { redirect } from 'next/navigation';

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Client portal", "Client home");


export default function ClientHomePage() {
  redirect('/app/client/inbox');
}
