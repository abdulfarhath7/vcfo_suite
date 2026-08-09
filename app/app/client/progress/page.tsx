import ClientProgress from "@/views/client/Progress";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Progress", "Incorporation progress");


export default function Page() {
  return <ClientProgress />;
}
