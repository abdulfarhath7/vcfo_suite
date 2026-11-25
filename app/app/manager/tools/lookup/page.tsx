import { pageMetadata } from "@/lib/shell/page-metadata";
import McaLookupView from "@/views/tools/McaLookupView";

export const metadata = pageMetadata("MCA Lookup", "Director and designated partner master data from MCA");

export default function Page() {
  return <McaLookupView />;
}
