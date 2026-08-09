import { Suspense } from "react";
import { pageMetadata } from "@/lib/page-metadata";
import FirmPeople from "@/views/admin/FirmPeople";

export const metadata = pageMetadata("People", "Admins, managers, leads, and clients");

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading people…</div>}>
      <FirmPeople />
    </Suspense>
  );
}
