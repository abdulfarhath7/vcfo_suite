import InternToday from "@/views/intern/Today";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Today", "Intern daily queue");


export default function Page() {
  return <InternToday />;
}
