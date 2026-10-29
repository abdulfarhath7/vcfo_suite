import { FieldHelpButton } from '@/components/ask/FieldHelpButton';
import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { GLOSSARY } from '@/data/ask/glossary';
import { firstGlossaryTerm } from '@/lib/ask/glossary-match';
import { Loader2, Upload } from 'lucide-react';
import type { ChecklistField } from '@/data/checklist';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { RepeatGroupEditor } from '@/views/incorporation/RepeatGroupEditor';
import { addRepeatEntry, isRepeatField, removeRepeatEntry } from '@/lib/checklist/checklist-repeat';
import { countWords, formatPre1DateDisplay } from '@/lib/checklist/checklist-pre1-validation';
import { getPre6DirectorNameOptions } from '@/lib/checklist/checklist-pre6-validation';
import { maxUploadSizeLabel } from '@/lib/upload-limits';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NoirDatePicker } from '@/components/noir/NoirDatePicker';
import { cn } from '@/lib/utils';
import {
  incorpDocTargetFromDraftField,
  isIncorpDraftUrlField,
} from '@/lib/incorporation-docs/client';
import { IncorporationDraftDocLink } from '@/components/incorporation/IncorporationDraftDocLink';
import { derivedDisplayPlaceholder } from '@/views/incorporation/milestone-response-form-utils';
import { FieldUnlockControl, UploadedFilePreview } from '@/views/incorporation/MilestoneResponseFormParts';
import { fieldErrorId, isNicCodeInput } from './helpers';
import type { FieldEditActions } from './field-edits';
import type { ReadOnlyFieldRenderers } from './read-only-field';
import type { MilestoneFormCtx } from './types';
import { FieldReviewControls, FieldReviewMark } from './field-review';

/** The editable control for one field, by field type (repeat groups render recursively). */
export function createEditableFieldRenderer(
  ctx: MilestoneFormCtx & FieldEditActions & Pick<ReadOnlyFieldRenderers, 'fieldShellClass'>,
) {
  const {
    item,
    engagementId,
    compactChrome,
    pre1Responses,
    draft,
    setDraft,
    uploadingField,
    setFieldErrors,
    isFieldUnlockedForAdmin,
    userEditedRef,
    autoSaveEnabled,
    clearDebounce,
    performSave,
    scheduleAutoSave,
    isPre1,
    isPre6,
    shownErrors,
    shownWarnings,
    toggleFieldUnlock,
    setField,
    handleFilePick,
    fieldShellClass,
  } = ctx;

  const renderEditableField = (
    field: ChecklistField,
    options?: { showUnlock?: boolean },
  ) => {
    const error = shownErrors[field.id];
    const warning = shownWarnings[field.id];
    const errorId = fieldErrorId(item.id, field.id);
    const invalidProps = error
      ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
      : {};
    const wordCount =
      field.type === 'textarea' && field.maxWords
        ? countWords(draft[field.id] ?? '')
        : null;

    return (
      <div key={field.id} className={fieldShellClass(field, compactChrome ? 'space-y-1.5' : 'space-y-2')}>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <FieldReviewMark engagementId={engagementId} itemId={item.id} fieldId={field.id} />
            <Label
              htmlFor={`${item.id}-${field.id}`}
              className="flex-1 text-xs font-medium leading-snug text-ink-muted"
            >
              {field.label}
              {field.required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
            </Label>
            <FieldReviewControls engagementId={engagementId} itemId={item.id} fieldId={field.id} label={field.label} />
            <FieldHelpButton stepId={item.id} fieldId={field.id} label={field.label} />
            {(() => {
              // Help icon only where Ask VCFO has something to say about the field.
              const term = firstGlossaryTerm(field.label, GLOSSARY);
              return term ? <WhatsThisButton compact kind="field" refId={term.term} label={field.label} /> : null;
            })()}
            <FieldUnlockControl
              field={field}
              showUnlock={options?.showUnlock}
              isUnlocked={isFieldUnlockedForAdmin(field.id)}
              onToggle={() => toggleFieldUnlock(field.id)}
            />
          </div>
        </div>

        {isRepeatField(field) ? (
          <RepeatGroupEditor
            group={field}
            responses={draft}
            renderField={(sub) => renderEditableField(sub)}
            onAdd={() => {
              userEditedRef.current = true;
              setDraft((prev) => ({ ...prev, ...addRepeatEntry(prev, field).patch }));
              if (autoSaveEnabled) scheduleAutoSave(false);
            }}
            onRemove={(entryId) => {
              userEditedRef.current = true;
              setDraft((prev) => ({ ...prev, ...removeRepeatEntry(prev, field, entryId) }));
              setFieldErrors((prev) => {
                const next = { ...prev };
                for (const key of Object.keys(next)) {
                  if (key.startsWith(`${field.id}.${entryId}.`)) delete next[key];
                }
                return next;
              });
              if (autoSaveEnabled) scheduleAutoSave(false);
            }}
          />
        ) : field.type === 'segmented' && field.options ? (
          <SegmentedPicker
            value={draft[field.id]?.trim() ? draft[field.id]! : null}
            options={field.options.map((opt) => ({ value: opt.value, label: opt.label }))}
            onChange={(next) => setField(field.id, next)}
            ariaLabel={field.label}
            ariaInvalid={Boolean(error)}
            ariaDescribedBy={error ? errorId : undefined}
            size="sm"
            className={cn('max-w-md', error && 'ring-1 ring-danger/40 rounded-md')}
          />
        ) : field.type === 'textarea' ? (
          <>
            <Textarea
              id={`${item.id}-${field.id}`}
              value={draft[field.id] ?? ''}
              onChange={(e) => setField(field.id, e.target.value)}
              onBlur={() => autoSaveEnabled && scheduleAutoSave(true)}
              placeholder={field.placeholder}
              rows={3}
              {...invalidProps}
              className={cn('milestone-form-textarea min-h-[72px] overflow-y-auto', error && 'border-danger')}
            />
            {field.maxWords != null && (
              <p
                className={cn(
                  'text-[12px] tabular-nums',
                  wordCount != null && wordCount > field.maxWords
                    ? 'text-danger'
                    : 'text-ink-muted',
                )}
              >
                {wordCount ?? 0} / {field.maxWords} words
              </p>
            )}
          </>
        ) : isPre1 && field.id.endsWith('Gender') && field.options ? (
          <div
            role="radiogroup"
            aria-label={field.label}
            {...invalidProps}
            className={cn(
              'inline-flex max-w-full flex-wrap gap-1 rounded-md border bg-surface-sunken/60 p-1',
              error ? 'border-danger' : 'border-line',
            )}
          >
            {field.options.map((opt) => {
              const selected = (draft[field.id] ?? '') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setField(field.id, opt.value)}
                  className={cn(
                    'milestone-segment-option',
                    selected
                      ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-line'
                      : 'text-ink-2 hover:bg-surface-raised/70 hover:text-ink',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        ) : field.type === 'select' &&
          ((isPre6 &&
            (field.id === 'shareholderAuthorizedPerson' ||
              field.id === 'shareholderNominee')) ||
            field.options) ? (
          (() => {
            const dynamicOptions =
              isPre6 &&
              (field.id === 'shareholderAuthorizedPerson' ||
                field.id === 'shareholderNominee')
                ? getPre6DirectorNameOptions(draft, pre1Responses)
                : field.options ?? [];
            return (
          <Select
            value={draft[field.id] ?? ''}
            onValueChange={(v) => setField(field.id, v)}
          >
            <SelectTrigger
              id={`${item.id}-${field.id}`}
              {...invalidProps}
              className={cn('milestone-form-input', error && 'border-danger')}
            >
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {dynamicOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
            );
          })()
        ) : field.type === 'file' ? (
          <div className="space-y-1.5">
            {draft[field.id]?.trim() ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {engagementId && isIncorpDraftUrlField(field.id) ? (
                    (() => {
                      const target = incorpDocTargetFromDraftField(field.id)!;
                      return (
                        <IncorporationDraftDocLink
                          engagementId={engagementId}
                          checklistItemId="pre-7"
                          doc={target.doc}
                          director={target.audience}
                          storagePath={draft[field.id]!}
                          label={field.label}
                          showDocxPreview={false}
                          docxPreviewPlaceholder="Word preview is in the Generate incorporation drafts panel at the top of this step — click Generate first."
                        />
                      );
                    })()
                  ) : (
                    <UploadedFilePreview storagePath={draft[field.id]!} label={field.label} />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={uploadingField === field.id}
                  onClick={() => {
                    setField(field.id, '');
                    if (autoSaveEnabled) {
                      clearDebounce();
                      void performSave({ [field.id]: '' });
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : null}
            <label
              className={cn(
                'milestone-upload-zone',
                error && 'border-danger',
                uploadingField === field.id && 'pointer-events-none opacity-60',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0] ?? null;
                void handleFilePick(field.id, file);
              }}
            >
              {uploadingField === field.id ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-text" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
              )}
              <span className="inline-flex h-7 shrink-0 items-center rounded-md border border-line bg-surface-sunken px-2.5 text-xs font-medium text-ink">
                {uploadingField === field.id
                  ? 'Uploading…'
                  : draft[field.id]?.trim()
                    ? 'Replace file'
                    : 'Choose file'}
              </span>
              <span className="min-w-0 truncate text-[12px] text-ink-muted">
                PDF, DOCX, or image · max {maxUploadSizeLabel()}
              </span>
              <input
                id={`${item.id}-${field.id}`}
                type="file"
                {...invalidProps}
                className="sr-only"
                accept={`${field.accept ?? '.pdf,image/*'},.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document`}
                disabled={uploadingField === field.id}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleFilePick(field.id, file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        ) : field.type === 'date' ? (
          item.id === 'pre-5' && field.id === 'nameApprovalExpiryDate' ? (
            <p
              className={cn(
                'text-sm leading-relaxed',
                draft[field.id]?.trim() ? 'text-ink' : 'text-ink-muted italic',
              )}
            >
              {draft[field.id]?.trim()
                ? formatPre1DateDisplay(draft[field.id]) ?? draft[field.id]
                : 'Set the approval date above to calculate expiry'}
            </p>
          ) : (
            <NoirDatePicker
              id={`${item.id}-${field.id}`}
              value={draft[field.id] ?? ''}
              onChange={(v) => setField(field.id, v)}
              onBlur={() => autoSaveEnabled && scheduleAutoSave(true)}
              invalid={Boolean(error)}
              describedBy={error ? errorId : undefined}
              className={cn(error && 'border-danger')}
            />
          )
        ) : derivedDisplayPlaceholder(item.id, field.id) ? (
          /* Derived from sibling answers — looks like a field, never typed. */
          <Input
            id={`${item.id}-${field.id}`}
            value={draft[field.id] ?? ''}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            placeholder={derivedDisplayPlaceholder(item.id, field.id) ?? undefined}
            className="milestone-form-input cursor-default bg-surface-sunken/40 text-ink focus-visible:ring-0"
          />
        ) : (
          <Input
            id={`${item.id}-${field.id}`}
            value={draft[field.id] ?? ''}
            onChange={(e) => setField(field.id, e.target.value)}
            onBlur={() => autoSaveEnabled && scheduleAutoSave(true)}
            placeholder={field.placeholder}
            {...invalidProps}
            className={cn('milestone-form-input', error && 'border-danger')}
            {...(isNicCodeInput(item.id, field.id)
              ? { inputMode: 'numeric' as const, maxLength: 5, pattern: '[0-9]*' }
              : {})}
          />
        )}

        {error && (
          <p id={errorId} tabIndex={-1} className="text-[12px] font-medium text-danger outline-none">
            {error}
          </p>
        )}
        {!error && warning && (
          <p className="text-[12px] text-warning">{warning}</p>
        )}
      </div>
    );
  };

  return renderEditableField;
}
