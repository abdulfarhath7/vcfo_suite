import { ReviewsPage } from '@/components/console/pages/lead/ReviewsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Reviews", "Drafts and client uploads waiting for your review");

export default function Page() {
  return <ReviewsPage />;
}
