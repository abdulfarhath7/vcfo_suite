import AdminVault from "@/views/admin/Vault";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Vault", "Document vault");


export default function Page() {
  return <AdminVault />;
}
