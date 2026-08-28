import ProjectEdit from "@/views/admin/ProjectEdit";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Edit project", "Edit project details");

export default function Page() {
  return <ProjectEdit />;
}
