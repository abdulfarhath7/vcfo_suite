import { pageMetadata } from "@/lib/shell/page-metadata";
import GstLookupView from "@/views/tools/GstLookupView";

export const metadata = pageMetadata("GST Lookup", "Look up taxpayer details by GSTIN/UIN");

export default function Page() {
  return <GstLookupView />;
}
