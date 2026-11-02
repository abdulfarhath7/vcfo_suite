import { RegistrationOpen } from '@/components/console/pages/lead/RegistrationOpen';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Registration', 'Opening the registration step');

/** `id` is `{engagementId}~{stepId}`; the registration is worked on its step page. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let key = id;
  try {
    key = decodeURIComponent(id);
  } catch {
    /* keep the raw segment */
  }
  return <RegistrationOpen recordKey={key} />;
}
