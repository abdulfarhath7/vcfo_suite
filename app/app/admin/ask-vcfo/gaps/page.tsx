import AskQuestionGaps from "@/views/admin/ask/AskQuestionGaps";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Ask VCFO question gaps", "What clients ask that has no reviewed answer yet");

export default function Page() {
  return <AskQuestionGaps />;
}
