import ManagerWork from "@/views/manager/ManagerWork";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Work", "Your project leads' steps, filings and tasks");

export default function Page() {
  return <ManagerWork />;
}
