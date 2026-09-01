import { redirect } from 'next/navigation';

/** Messaging is not shipped yet. */
export default function Page() {
  redirect('/app/client/overview');
}
