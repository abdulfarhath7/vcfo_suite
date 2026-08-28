import ProjectRecycleBin from "@/views/admin/ProjectRecycleBin";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Deleted projects", "Restore a deleted project");

export default function Page() {
  return <ProjectRecycleBin />;
}
