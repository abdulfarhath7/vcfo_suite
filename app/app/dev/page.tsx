import { redirect } from 'next/navigation';

/** `/app/dev` opens the console home (the prototype's `/dev` redirect). The layout guards the role. */
export default function Page() {
  redirect('/app/dev/overview');
}
