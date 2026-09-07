import { redirect } from 'next/navigation';

/** Legacy route — the compliance calendar now lives under the Compliances group. */
export default function Page() {
  redirect('/app/manager/compliances/calendar');
}
