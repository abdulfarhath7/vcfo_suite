import { pageMetadata } from "@/lib/page-metadata";
import FirmDashboard from "@/views/admin/FirmDashboard";

export const metadata = pageMetadata("Admin home", "Firm-wide portfolio pulse and attention queue");

export default function Page() {
  return <FirmDashboard />;
}
