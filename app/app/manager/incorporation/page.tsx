import StaffPracticeIncorporation from '@/views/practice/StaffPracticeIncorporation';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Incorporation', 'Clients in incorporation, by phase and current step');

/** Route shell only (R-51). The scoped read decides the rows. */
export default function Page() {
  return <StaffPracticeIncorporation base="/app/manager" />;
}
