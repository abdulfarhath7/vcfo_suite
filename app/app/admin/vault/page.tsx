import { pageMetadata } from "@/lib/page-metadata";
import Vault from "@/views/admin/Vault";

export const metadata = pageMetadata("Doc vault", "Firm document vault");

export default function Page() {
  return <Vault />;
}
