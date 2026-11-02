import { redirect } from 'next/navigation';

/* Practice has no page of its own; links and the breadcrumb to it open Incorporation. */
export default function Page() {
  redirect('/app/super/practice/incorporation');
}
