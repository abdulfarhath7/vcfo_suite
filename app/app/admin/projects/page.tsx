import { pageMetadata } from "@/lib/page-metadata";
import FirmProjects from "@/views/admin/FirmProjects";

export const metadata = pageMetadata("Projects", "Firm-wide GCC projects");

export default function Page() {
  return <FirmProjects />;
}
