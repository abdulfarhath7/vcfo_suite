type DeadlineRule =
  | { kind: 'days-from-incorporation'; days: number }
  | { kind: 'fixed-window-weeks'; weeks: number }
  | { kind: 'estimated-weeks'; weeks: [number, number] }
  | { kind: 'no-statutory-limit' }
  | { kind: 'wherever-applicable' };

type Bucket = 'pre-inc' | 'post-inc' | 'fema' | 'statutory';

const STAGES = ['Pre-Incorporation', 'Post-Incorporation', 'Operational Readiness'] as const;
type Stage = (typeof STAGES)[number];

const PHASE_BUCKET_PLAN: Record<
  Stage,
  { completed: Bucket[]; active: Bucket[] }
> = {
  'Pre-Incorporation': { completed: [], active: ['pre-inc'] },
  'Post-Incorporation': { completed: ['pre-inc'], active: ['post-inc'] },
  'Operational Readiness': {
    completed: ['pre-inc', 'post-inc'],
    active: ['fema', 'statutory'],
  },
};

function formatTimeline(rule: DeadlineRule): string {
  switch (rule.kind) {
    case 'days-from-incorporation':
      return `Within ${rule.days} days of incorporation`;
    case 'fixed-window-weeks':
      return `Within ${rule.weeks} weeks of incorporation`;
    case 'estimated-weeks':
      return `${rule.weeks[0]}–${rule.weeks[1]} weeks (estimated)`;
    case 'no-statutory-limit':
      return 'No statutory time limit';
    case 'wherever-applicable':
      return 'Wherever applicable';
  }
}

const CHECKLIST: Array<{ bucket: Bucket; title: string; deadline: DeadlineRule }> = [
  { bucket: 'pre-inc', title: 'Name Approval', deadline: { kind: 'estimated-weeks', weeks: [1, 2] } },
  { bucket: 'pre-inc', title: 'Director Appointment', deadline: { kind: 'estimated-weeks', weeks: [3, 4] } },
  { bucket: 'pre-inc', title: 'Director DSC', deadline: { kind: 'estimated-weeks', weeks: [3, 4] } },
  { bucket: 'pre-inc', title: 'Registered Office', deadline: { kind: 'estimated-weeks', weeks: [3, 4] } },
  { bucket: 'pre-inc', title: 'Foreign Entity Details', deadline: { kind: 'estimated-weeks', weeks: [3, 4] } },
  { bucket: 'post-inc', title: 'First Board Meeting', deadline: { kind: 'days-from-incorporation', days: 30 } },
  { bucket: 'post-inc', title: 'Bank Account Opening', deadline: { kind: 'no-statutory-limit' } },
  { bucket: 'post-inc', title: 'ROC Office Intimation', deadline: { kind: 'days-from-incorporation', days: 30 } },
  { bucket: 'post-inc', title: 'PAN / TAN', deadline: { kind: 'days-from-incorporation', days: 30 } },
  { bucket: 'post-inc', title: 'GST Registration', deadline: { kind: 'days-from-incorporation', days: 30 } },
  { bucket: 'post-inc', title: 'PT / Shops & Establishment', deadline: { kind: 'wherever-applicable' } },
  { bucket: 'fema', title: 'FEMA Inward Remittance', deadline: { kind: 'wherever-applicable' } },
  { bucket: 'fema', title: 'Annual FEMA Return (APR)', deadline: { kind: 'fixed-window-weeks', weeks: 52 } },
  { bucket: 'statutory', title: 'Annual ROC Filings', deadline: { kind: 'fixed-window-weeks', weeks: 52 } },
  { bucket: 'statutory', title: 'Income Tax Return', deadline: { kind: 'fixed-window-weeks', weeks: 52 } },
];

export interface DueLine {
  title: string;
  timeline: string;
}

export function dueItemsForStage(stage: string): DueLine[] {
  const key = STAGES.includes(stage as Stage) ? (stage as Stage) : 'Pre-Incorporation';
  const plan = PHASE_BUCKET_PLAN[key];
  const activeBuckets = new Set(plan.active);
  const items: DueLine[] = [];
  for (const item of CHECKLIST) {
    if (activeBuckets.has(item.bucket)) {
      items.push({ title: item.title, timeline: formatTimeline(item.deadline) });
    }
  }
  return items;
}

export function formatEngagementDueContext(stage: string, health: string, createdAt: string): string[] {
  const created = new Date(createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? createdAt
    : created.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return [
    `Current phase: ${stage}`,
    `Health status: ${health.replace(/-/g, ' ')}`,
    `Project opened: ${createdLabel}`,
  ];
}
