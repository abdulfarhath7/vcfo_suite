import InternTasks from "@/views/intern/Tasks";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Tasks", "Intern tasks");


export default function Page() {
  return <InternTasks />;
}
