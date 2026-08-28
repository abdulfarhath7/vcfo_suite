import { pageMetadata } from "@/lib/page-metadata";
import Compliance from "@/views/admin/Compliance";

export const metadata = pageMetadata("Filing tracker", "Client filing status");

export default function Page() {
  return <Compliance initialView="tracker" />;
}
