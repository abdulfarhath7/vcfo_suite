import { redirect } from 'next/navigation';

/** Moved into the console's Project leads page (portal redesign, Oct 2026). */
export default function Page() {
  redirect('/app/manager/leads');
}
