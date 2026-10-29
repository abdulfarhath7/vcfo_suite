import type { ChecklistField } from '@/data/checklist';
import {
  applyShowWhen,
  expandRepeatEntry,
  isRepeatField,
  repeatEntries,
  resolveFieldLabels,
} from '@/lib/checklist/checklist-repeat';
import { formatPre1DateDisplay } from '@/lib/checklist/checklist-pre1-validation';
import { cn } from '@/lib/utils';
import {
  incorpDocTargetFromDraftField,
  isIncorpDraftUrlField,
} from '@/lib/incorporation-docs/client';
import { IncorporationDraftDocLink } from '@/components/incorporation/IncorporationDraftDocLink';
import { MilestoneFileDisplay } from '@/components/incorporation/MilestoneFileDisplay';
import { getMilestoneFormFieldLayout } from '@/views/incorporation/milestone-response-form-utils';
import { FieldUnlockControl } from '@/views/incorporation/MilestoneResponseFormParts';
import { isLeadOnlyField, LEAD_ONLY_FIELD_HELPER } from '@/lib/incorporation/pre-inc-direct-flow';
import type { FieldEditActions } from './field-edits';
import type { MilestoneFormCtx } from './types';
import { FieldReviewControls, FieldReviewMark } from './field-review';

/** Read-only field rendering: the staff read-only field and the client record row. */
export function createReadOnlyFieldRenderers(ctx: MilestoneFormCtx & FieldEditActions) {
  const {
    item,
    engagementId,
    isClient,
    directFlow,
    isFieldUnlockedForAdmin,
    displayValues,
    toggleFieldUnlock,
  } = ctx;

  /** Lead-only field on the client's form: read-only, with a line saying who fills it. */
  const leadOnlyNote = (fieldId: string) =>
    isClient && directFlow && isLeadOnlyField(item.id, fieldId) ? (
      <p className="text-[12px] text-ink-muted">{LEAD_ONLY_FIELD_HELPER}</p>
    ) : null;

  const fieldShellClass = (field: ChecklistField, stacked: string) =>
    cn(
      'min-w-0',
      stacked,
      getMilestoneFormFieldLayout(field) === 'full' && 'milestone-form-field-full',
    );

  /**
   * The value half of a read-only field, shared by the staff layout and the
   * client record view. `empty` differs: staff keep the existing italic
   * "Not provided yet"; the client record shows a muted em dash.
   */
  const readOnlyValueNode = (field: ChecklistField, empty: 'text' | 'dash') => {
    const value = (displayValues[field.id] ?? '').trim();
    const emptyLabel = empty === 'dash' ? '—' : 'Not provided yet';
    const emptyClass =
      empty === 'dash' ? 'text-ink-muted' : 'text-ink-muted italic';

    if (field.type === 'file') {
      if (!value) return <p className={cn('text-sm', emptyClass)}>{emptyLabel}</p>;
      if (engagementId && isIncorpDraftUrlField(field.id)) {
        const target = incorpDocTargetFromDraftField(field.id)!;
        return (
          <IncorporationDraftDocLink
            engagementId={engagementId}
            checklistItemId="pre-7"
            doc={target.doc}
            director={target.audience}
            storagePath={value}
            label={field.label}
            showDocxPreview={false}
            docxPreviewPlaceholder="Word preview is in the Generate incorporation drafts panel at the top of this step — click Generate first."
          />
        );
      }
      return <MilestoneFileDisplay storagePath={value} label={field.label} />;
    }

    if (isRepeatField(field)) {
      const entries = repeatEntries(displayValues, field);
      if (entries.length === 0) {
        return (
          <p className={cn('text-sm', emptyClass)}>
            {field.emptyLabel ?? emptyLabel}
          </p>
        );
      }
      return (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-line/70 px-3 py-2">
              <p className="mb-1.5 text-[12px] font-semibold tracking-[.07em] uppercase text-ink-muted">
                {field.entryLabel ?? 'Entry'} {entry.index}
              </p>
              <dl className="milestone-record">
                {resolveFieldLabels(applyShowWhen(expandRepeatEntry(field, entry.id), displayValues), displayValues).map((sub) => (
                  <div key={sub.id} className="milestone-record-row">
                    <dt className="milestone-record-label">{sub.label}</dt>
                    <dd className="milestone-record-value">{readOnlyValueNode(sub, empty)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      );
    }

    if ((field.type === 'select' || field.type === 'segmented') && field.options) {
      return (
        <p className={cn('text-sm leading-relaxed', value ? 'text-ink' : emptyClass)}>
          {value ? (field.options.find((o) => o.value === value)?.label ?? value) : emptyLabel}
        </p>
      );
    }

    if (field.type === 'date') {
      return (
        <p className={cn('text-sm leading-relaxed', value ? 'text-ink' : emptyClass)}>
          {value ? (formatPre1DateDisplay(value) ?? value) : emptyLabel}
        </p>
      );
    }

    return (
      <p
        className={cn(
          'text-sm leading-relaxed whitespace-pre-wrap',
          value ? 'text-ink' : emptyClass,
        )}
      >
        {value || emptyLabel}
      </p>
    );
  };

  const renderReadOnlyField = (field: ChecklistField, options?: { showUnlock?: boolean }) => (
    <div key={field.id} className={fieldShellClass(field, 'space-y-1.5')}>
      <div className="flex items-center justify-between gap-3">
        <FieldReviewMark engagementId={ctx.engagementId} itemId={ctx.item.id} fieldId={field.id} />
        <p className="flex-1 text-xs font-medium leading-snug text-ink-muted">
          {field.label}
        </p>
        <FieldReviewControls engagementId={ctx.engagementId} itemId={ctx.item.id} fieldId={field.id} label={field.label} />
        <FieldUnlockControl
          field={field}
          showUnlock={options?.showUnlock}
          isUnlocked={isFieldUnlockedForAdmin(field.id)}
          onToggle={() => toggleFieldUnlock(field.id)}
        />
      </div>
      {readOnlyValueNode(field, 'text')}
      {leadOnlyNote(field.id)}
    </div>
  );

  /** Client record view: one definition row — muted label column, value column. */
  const renderRecordRow = (field: ChecklistField) => (
    <div key={field.id} className="milestone-record-row">
      <dt className="milestone-record-label">{field.label}</dt>
      <dd className="milestone-record-value">
        {readOnlyValueNode(field, 'dash')}
        {leadOnlyNote(field.id)}
      </dd>
    </div>
  );

  return {
    leadOnlyNote,
    fieldShellClass,
    renderReadOnlyField,
    renderRecordRow,
  };
}

export type ReadOnlyFieldRenderers = ReturnType<typeof createReadOnlyFieldRenderers>;
