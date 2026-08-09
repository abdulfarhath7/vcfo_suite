import { redirect } from 'next/navigation';

/** Messaging is not shipped yet — send clients to their action inbox. */
export default function Page() {
  redirect('/app/client/inbox');
}
