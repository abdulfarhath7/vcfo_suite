'use client';

import { HelpIcon } from '@/components/ui/help-icon';
import { fieldHelp } from '@/data/ask/field-help';
import { useAskOptional } from './ask-context';

/**
 * C3 "Why do we ask this?" — a reviewed one-liner beside a client form field.
 * Client persona only, behind ASK_VCFO_FEATURE_C3; renders nothing when the
 * field has no reviewed line. No model call.
 */
export function FieldHelpButton({ stepId, fieldId, label }: { stepId: string; fieldId: string; label: string }) {
  const ask = useAskOptional();
  if (!ask?.enabled || ask.shell !== 'client' || ask.preview || !ask.features.C3) return null;
  const text = fieldHelp(stepId, fieldId);
  if (!text) return null;
  // GL-04: the same (i) icon and pop-up as every other form help.
  return <HelpIcon text={text} title={label} />;
}
