import { redirect } from 'next/navigation';

/** Messages to the lead live in the Messages card on Home (G-09); the old route opens Home. */
export default function Page() {
  redirect('/app/client/overview');
}
