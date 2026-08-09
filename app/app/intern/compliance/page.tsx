import { pageMetadata } from "@/lib/page-metadata";
import Compliance from "@/views/admin/Compliance";

export const metadata = pageMetadata("Compliance calendar", "Filings and due dates");

export default function Page() {
  return <Compliance />;
}
