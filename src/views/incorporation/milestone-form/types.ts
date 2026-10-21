import type { ChecklistItem } from '@/data/checklist';
import type { MilestoneSources } from './use-milestone-sources';
import type { MilestoneDraft } from './use-milestone-draft';
import type { MilestoneUiState } from './use-milestone-ui-state';
import type { MilestoneAccess } from './use-milestone-access';
import type { MilestoneAutoSave } from './use-milestone-autosave';
import type { MilestoneSections } from './use-milestone-sections';

/** The props every piece of the form reads, after defaults are applied. */
export interface MilestoneFormBase {
  item: ChecklistItem;
  clientId: string;
  engagementId?: string;
  variant: 'admin' | 'client';
  readOnly: boolean;
  showFieldUnlock: boolean;
  compactChrome: boolean;
  sectionTabs: boolean;
}

/**
 * Everything the sub-hooks produce, merged. The action and render factories
 * (`field-edits.ts`, `submit-actions.ts`, `*-field.tsx`, `field-groups.tsx`)
 * take this one object instead of long parameter lists.
 */
export type MilestoneFormCtx = MilestoneFormBase &
  MilestoneSources &
  MilestoneDraft &
  MilestoneUiState &
  MilestoneAccess &
  MilestoneAutoSave &
  MilestoneSections;
