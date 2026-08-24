import { redirect } from "next/navigation";

/** Document-request list removed; pending items live on My work. */
export default function Page() {
  redirect("/app/intern/tasks");
}
