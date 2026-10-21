import { pageMetadata } from "@/lib/shell/page-metadata";
import Vault from "@/views/admin/Vault";

export const metadata = pageMetadata("Doc vault", "Firm document vault");

export default function Page() {
  return <Vault />;
}
