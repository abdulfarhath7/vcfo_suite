'use client';

import type { ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import type { ChecklistItemState } from '@/context/AppContext';
import {
  Phase1Pre2Panel,
  Phase1Pre3Panel,
  Phase1Pre4Panel,
  Phase1Pre5Panel,
  Phase1Pre7Panel,
  Phase1Pre8Panel,
  Phase1Pre9Panel,
  Phase1Pre10Panel,
  Phase1Pre11Panel,
  Phase1Pre12Panel,
} from '@/components/incorporation/Phase1StepPanelRoutePanels';

export type Phase1StepPanelRoutesProps = {
  item: ChecklistItem;
  engagement?: Engagement;
  responses: ChecklistItemResponses;
  className?: string;
  isClient: boolean;
  isIntern: boolean;
  brStatus: 'loading' | 'none' | 'draft' | 'finalized' | 'signed';
  deliveredToClient: boolean;
  itemState?: ChecklistItemState;
  incorpDraftLabelOptions: { pre6: ChecklistItemResponses };
  getStateForEngagement: (engagement: Engagement) => Record<string, ChecklistItemState | undefined>;
};

const PHASE1_STEP_PANEL_IDS = [
  'pre-2',
  'pre-3',
  'pre-4',
  'pre-5',
  'pre-7',
  'pre-8',
  'pre-9',
  'pre-10',
  'pre-11',
  'pre-12',
] as const;

export function Phase1StepPanelRoutes(props: Phase1StepPanelRoutesProps) {
  const { item } = props;
  if (!PHASE1_STEP_PANEL_IDS.includes(item.id as (typeof PHASE1_STEP_PANEL_IDS)[number])) {
    return null;
  }
  switch (item.id) {
    case 'pre-2':
      return <Phase1Pre2Panel {...props} />;
    case 'pre-3':
      return <Phase1Pre3Panel {...props} />;
    case 'pre-4':
      return <Phase1Pre4Panel {...props} />;
    case 'pre-5':
      return <Phase1Pre5Panel {...props} />;
    case 'pre-7':
      return <Phase1Pre7Panel {...props} />;
    case 'pre-8':
      return <Phase1Pre8Panel {...props} />;
    case 'pre-9':
      return <Phase1Pre9Panel {...props} />;
    case 'pre-10':
      return <Phase1Pre10Panel {...props} />;
    case 'pre-11':
      return <Phase1Pre11Panel {...props} />;
    case 'pre-12':
      return <Phase1Pre12Panel {...props} />;
    default:
      return null;
  }
}
