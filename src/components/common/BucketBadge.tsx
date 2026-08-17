import { Bucket, BUCKET_LABEL } from '@/data/checklist';

const tone: Record<Bucket, string> = {
  'pre-inc': 'bg-indigo-50 text-indigo-700',
  'post-inc': 'bg-accent-violet/10 text-accent-violet',
  fema: 'bg-info-light text-info-text',
  statutory: 'bg-[oklch(var(--phase-registration-soft))] text-[oklch(var(--phase-registration-text))]',
};

export function BucketBadge({ bucket }: { bucket: Bucket }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[bucket]}`}
    >
      {BUCKET_LABEL[bucket]}
    </span>
  );
}
