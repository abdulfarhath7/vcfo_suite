import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { uploadMilestoneDocument } from '@/lib/documents/milestone-document-storage';
import { cascadeDraftFieldChange, clearCascadedFieldErrors } from './field-cascade';
import type { MilestoneFormCtx } from './types';

/** Per-field edits: typing a value, uploading a file, and the staff lock/unlock toggle. */
export function createFieldEditActions(ctx: MilestoneFormCtx) {
  const {
    item,
    showFieldUnlock,
    setUnlockedFields,
    engagement,
    setDraft,
    setUploadingField,
    setFieldErrors,
    submissionLocked,
    unlockedFields,
    optimisticUnlock,
    setOptimisticUnlock,
    isFieldUnlockedForAdmin,
    userEditedRef,
    autoSaveEnabled,
    scopeId,
    clearDebounce,
    performSave,
    scheduleAutoSave,
  } = ctx;

  const toggleFieldUnlock = (fieldId: string) => {
    if (!showFieldUnlock || !submissionLocked) return;
    const nextUnlocked = !isFieldUnlockedForAdmin(fieldId);
    setOptimisticUnlock((prev) => ({ ...prev, [fieldId]: nextUnlocked }));

    const nextSet = new Set(unlockedFields);
    for (const [id, unlocked] of Object.entries({ ...optimisticUnlock, [fieldId]: nextUnlocked })) {
      if (unlocked) nextSet.add(id);
      else nextSet.delete(id);
    }
    const next = [...nextSet];

    void setUnlockedFields(scopeId, item.id, next)
      .then(() => {
        toastSuccess(
          nextUnlocked ? 'Field unlocked' : 'Field locked',
          nextUnlocked
            ? 'The client can edit this field again.'
            : 'This field is read-only for the client.',
        );
      })
      .catch((err) => {
        setOptimisticUnlock((prev) => {
          const { [fieldId]: _removed, ...rest } = prev;
          return rest;
        });
        toastError('Could not update field access', errorMessage(err, 'Try again.'));
      });
  };

  const setField = (fieldId: string, value: string) => {
    userEditedRef.current = true;
    setDraft((prev) => cascadeDraftFieldChange(item.id, prev, fieldId, value));
    setFieldErrors((prev) => clearCascadedFieldErrors(item.id, prev, fieldId, value));
    if (autoSaveEnabled) scheduleAutoSave(false);
  };

  const handleFilePick = async (fieldId: string, file: File | null) => {
    if (!file || !engagement) {
      return;
    }
    setUploadingField(fieldId);
    try {
      const path = await uploadMilestoneDocument(engagement.id, fieldId, file, {
        stepId: item.id,
      });
      userEditedRef.current = true;
      setDraft((prev) => ({ ...prev, [fieldId]: path }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      clearDebounce();
      await performSave({ [fieldId]: path });
      toastSuccess('Uploaded', file.name);
    } catch (err) {
      toastError('Upload failed', errorMessage(err, 'Could not upload file.'));
    } finally {
      setUploadingField(null);
    }
  };

  return {
    toggleFieldUnlock,
    setField,
    handleFilePick,
  };
}

export type FieldEditActions = ReturnType<typeof createFieldEditActions>;
