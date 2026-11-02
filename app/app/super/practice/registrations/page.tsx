import SuperPracticeRegistrations from '@/views/super/SuperPracticeRegistrations';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Registrations', 'Registration steps across every client');

export default function Page() {
  return <SuperPracticeRegistrations />;
}
