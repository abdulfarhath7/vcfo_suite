import { redirect } from "next/navigation";

/** Intern Tasks folded into Today’s week queue. */
export default function Page() {
  redirect("/app/intern/today");
}
