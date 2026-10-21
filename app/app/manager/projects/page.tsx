import AdminProjects from "@/views/admin/Projects";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Projects", "Manage client projects");


export default function Page() {
  return <AdminProjects />;
}
