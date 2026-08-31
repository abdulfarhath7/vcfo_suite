import ClientOverviewView from "@/views/client/Overview";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Home", "Your India entity at a glance");

export default function Page() {
  return <ClientOverviewView />;
}
