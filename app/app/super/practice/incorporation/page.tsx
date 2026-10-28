import SuperPracticeIncorporation from '@/views/super/SuperPracticeIncorporation';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Incorporation', 'Every client in incorporation, by phase and current step');

export default function Page() {
  return <SuperPracticeIncorporation />;
}
