import AdminCompliance from "@/views/admin/Compliance";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Compliance", "Compliance calendar");


export default function Page() {
  return <AdminCompliance />;
}
