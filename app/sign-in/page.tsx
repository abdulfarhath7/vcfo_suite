import { redirect } from 'next/navigation';

/**
 * /sign-in is an alias of /login (the prototype's sign-in path). It keeps the query string, so
 * `?next=…`, `?reset=…` and `?error=…` still reach the sign-in card.
 */
export default async function SignInAlias({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.append(key, value);
    else if (Array.isArray(value)) for (const v of value) query.append(key, v);
  }
  const qs = query.toString();
  redirect(qs ? `/login?${qs}` : '/login');
}
