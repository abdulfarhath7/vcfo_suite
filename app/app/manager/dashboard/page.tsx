import AdminDashboard from "@/views/admin/Dashboard";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Dashboard", "Admin dashboard");


export default function Page() {
  return <AdminDashboard />;
}
