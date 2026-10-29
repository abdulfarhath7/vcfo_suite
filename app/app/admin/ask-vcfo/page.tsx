import { redirect } from 'next/navigation';

/* Ask VCFO has no page of its own; links and the breadcrumb to it open Question gaps. */
export default function Page() {
  redirect('/app/admin/ask-vcfo/gaps');
}
