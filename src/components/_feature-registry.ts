/** Intentional feature/library surface — keeps modules reachable for tooling. */

import { StepDetailDrawer } from '@/components/admin/StepDetailDrawer';

import { passwordStrength, createProjectReducer } from '@/components/admin/create-project-form-utils';

import { BoardResolutionDocumentPanel } from '@/components/board-resolution/BoardResolutionDocumentPanel';

import { BoardResolutionMergeFieldsPanel } from '@/components/board-resolution/BoardResolutionMergeFieldsPanel';

import { ClientBoardResolutionCard } from '@/components/client/ClientBoardResolutionCard';

import { BucketBadge } from '@/components/common/BucketBadge';

import { EmptyState } from '@/components/common/EmptyState';

import { KpiCard } from '@/components/common/KpiCard';

import { SectionHeader } from '@/components/common/SectionHeader';

import { Dir2GeneratePanel } from '@/components/incorporation/Dir2GeneratePanel';

import { useIsMobile } from '@/hooks/use-mobile';

import { useStableId } from '@/hooks/use-stable-id';

import AdminEngagements from '@/views/admin/Engagements';

import AdminOverview from '@/views/admin/Overview';

import Incorporation from '@/views/incorporation/Incorporation';

import { FemaSection } from '@/views/incorporation/sections/FemaSection';

import { loadStepProgress, saveStepProgress, stepDetailUiReducer } from '@/components/admin/step-detail-progress';
import { FieldUnlockControl, FieldUnlockIconButton } from '@/views/incorporation/MilestoneResponseFormParts';

import {

  getChangedPartial,

  groupFieldsBySection,

  milestoneFormReducer,

  runStepValidation,

} from '@/views/incorporation/milestone-response-form-utils';

import OnboardingWizard from '@/views/onboarding/OnboardingWizard';

import { Step1Company } from '@/views/onboarding/steps/Step1Company';

import { Step2Directors } from '@/views/onboarding/steps/Step2Directors';

import { Step3Office } from '@/views/onboarding/steps/Step3Office';

import { Step4Foreign } from '@/views/onboarding/steps/Step4Foreign';

import { Step5Review } from '@/views/onboarding/steps/Step5Review';



export const featureRegistry = {

  StepDetailDrawer,

  passwordStrength,

  createProjectReducer,

  BoardResolutionDocumentPanel,

  BoardResolutionMergeFieldsPanel,

  ClientBoardResolutionCard,

  BucketBadge,

  EmptyState,

  KpiCard,

  SectionHeader,

  Dir2GeneratePanel,

  useIsMobile,

  AdminEngagements,

  AdminOverview,

  Incorporation,

  FemaSection,

  FieldUnlockControl,

  FieldUnlockIconButton,

  getChangedPartial,

  groupFieldsBySection,

  loadStepProgress,

  milestoneFormReducer,

  runStepValidation,

  saveStepProgress,

  stepDetailUiReducer,

  OnboardingWizard,

  Step1Company,

  Step2Directors,

  Step3Office,

  Step4Foreign,

  Step5Review,

} as const;


