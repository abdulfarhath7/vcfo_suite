import { pageMetadata } from "@/lib/page-metadata";
import ClientCompliances from "@/views/client/Compliances";

export const metadata = pageMetadata("Compliances", "GST, tax, and payroll obligations");

export default function Page() {
  return <ClientCompliances />;
}
