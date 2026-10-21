import InviteAccept from "@/views/auth/InviteAccept";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Accept invite", "Accept your VCFO Suite invitation");


export default function InvitePage() {
  return <InviteAccept />;
}
