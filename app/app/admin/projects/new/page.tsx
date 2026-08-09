import { pageMetadata } from "@/lib/page-metadata";
import ProjectsNew from "@/views/admin/ProjectsNew";

export const metadata = pageMetadata("New project", "Create GCC project and assign PM");

export default function Page() {
  return <ProjectsNew />;
}
