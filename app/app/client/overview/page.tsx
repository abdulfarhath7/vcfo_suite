import { HomePage } from "@/components/client-portal/pages/home/HomePage";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Home", "Your India entity at a glance");

export default function Page() {
  return <HomePage />;
}
