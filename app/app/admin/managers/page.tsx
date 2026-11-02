import ManagersPage from "@/views/admin/managers/ManagersPage";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Managers", "Managers, their clients and leads, escalations and clients to assign");

export default function Page() {
  return <ManagersPage />;
}
