import { useState } from 'react';
import type { StaffSaveStatus } from '@/views/incorporation/milestone-response-form-utils';

/** Plain UI flags for the form: save and submit progress, uploads, explicit errors. */
export function useMilestoneUiState() {
  const [saving, setSaving] = useState(false);
  const [staffSaveStatus, setStaffSaveStatus] = useState<StaffSaveStatus>('idle');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [peakEndMoment, setPeakEndMoment] = useState<'submit' | null>(null);

  return {
    saving,
    setSaving,
    staffSaveStatus,
    setStaffSaveStatus,
    uploadingField,
    setUploadingField,
    fieldErrors,
    setFieldErrors,
    fieldWarnings,
    setFieldWarnings,
    submitting,
    setSubmitting,
    peakEndMoment,
    setPeakEndMoment,
  };
}

export type MilestoneUiState = ReturnType<typeof useMilestoneUiState>;
