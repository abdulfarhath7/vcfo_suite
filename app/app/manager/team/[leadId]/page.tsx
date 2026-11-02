import { redirect } from 'next/navigation';

/**
 * Old-shell "one project lead" page (/app/manager/team/<lead>). The console's Project leads page
 * shows one lead at a time and takes the lead in `?lead=`, so this address only forwards there.
 */
export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  let key = leadId;
  try {
    key = decodeURIComponent(leadId);
  } catch {
    /* keep the raw segment */
  }
  redirect(`/app/manager/leads?lead=${encodeURIComponent(key)}`);
}
