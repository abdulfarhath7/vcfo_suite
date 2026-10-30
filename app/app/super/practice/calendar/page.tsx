import { redirect } from 'next/navigation';

/* The shared views link to `<base>/calendar`; on the super admin shell that page is Practice · Compliances. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string') q.set(k, v);
  const s = q.toString();
  redirect(`/app/super/practice/compliances${s ? `?${s}` : ''}`);
}
