"use client";

import { useEffect, useMemo, useReducer } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import type { Engagement } from "@/data/engagements";
import { CreateProjectFormView } from '@/components/admin/CreateProjectFormSections';
import { toastError, toastSuccess, toastEmailDispatch, errorMessage } from "@/lib/toast-errors";
import {
  companyNameSchema,
  emailSchema,
  clientPasswordSchema,
  companyTypeSchema,
  entityLegalFormSchema,
  parentEntityNameSchema,
  parentEntityAddressSchema,
  subsidiaryLegalNameSchema,
  subsidiaryRegisteredAddressSchema,
} from "@/lib/api/schemas";
import {
  createProjectReducer,
  passwordStrength,
  DEFAULT_CLIENT_TEMP_PASSWORD,
  loadCreateProjectDraft,
  saveCreateProjectDraft,
  clearCreateProjectDraft,
  stageRequiresSubsidiary,
  type CreateProjectState,
} from '@/components/admin/create-project-form-utils';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';

export type CreateProjectFormProps = {
  onSuccess: (engagement: Engagement) => void;
  onCancel?: () => void;
  /** Called after successful create so parent can close dialog / reset */
  onCreated?: () => void;
};

type ManagerOption = { id: string; name: string; email: string };

function initialCreateProjectState(internIds: string[]): CreateProjectState {
  return {
    companyName: '',
    companyType: 'domestic',
    entityLegalForm: 'company',
    parentEntityName: '',
    parentEntityAddress: '',
    subsidiaryLegalName: '',
    subsidiaryRegisteredAddress: '',
    clientContact: '',
    clientEmail: '',
    clientPassword: DEFAULT_CLIENT_TEMP_PASSWORD,
    internIds,
    managerIds: [],
    stage: 'Pre-Incorporation',
    health: 'on-track',
    submitting: false,
    showValidation: false,
    showPassword: false,
  };
}

function uniqueNonEmpty(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

export function CreateProjectForm({ onSuccess, onCancel, onCreated }: CreateProjectFormProps) {
  const { createProjectWithClient, internOptions, internsLoading, teamMembers, user } = useApp();
  const owners = internOptions.length ? internOptions : teamMembers;
  const defaultInternId = owners[0]?.id || 'tm1';
  const isFirmAdmin = isFirmWideAdmin(user?.role);
  const isManager = user?.role === 'manager';
  const canCreate = isAdminOrManager(user?.role);
  const selfManagerId = user?.id ?? '';

  const managersQuery = useQuery({
    queryKey: ['admin-managers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/managers');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `http_${res.status}`);
      return (body.managers ?? []) as ManagerOption[];
    },
    enabled: canCreate,
    staleTime: 5 * 60_000,
  });

  const [state, dispatch] = useReducer(
    createProjectReducer,
    [defaultInternId],
    initialCreateProjectState,
  );

  useEffect(() => {
    const draft = loadCreateProjectDraft();
    if (!draft) return;
    const internIds =
      draft.internIds.length > 0 ? draft.internIds : defaultInternId ? [defaultInternId] : [];
    let managerIds = draft.managerIds;
    if (isManager && selfManagerId) {
      managerIds = uniqueNonEmpty([selfManagerId, ...managerIds]);
    }
    dispatch({
      type: 'patch',
      patch: {
        ...draft,
        internIds,
        managerIds,
      },
    });
  }, [defaultInternId, isManager, selfManagerId]);

  const {
    companyName,
    companyType,
    entityLegalForm,
    parentEntityName,
    parentEntityAddress,
    subsidiaryLegalName,
    subsidiaryRegisteredAddress,
    clientContact,
    clientEmail,
    clientPassword,
    internIds,
    managerIds,
    stage,
    submitting,
    showValidation,
    showPassword,
  } = state;

  useEffect(() => {
    if (!canCreate) return;
    if (isManager && selfManagerId) {
      if (!managerIds.includes(selfManagerId)) {
        dispatch({
          type: 'patch',
          patch: { managerIds: uniqueNonEmpty([selfManagerId, ...managerIds]) },
        });
      }
      return;
    }
    if (isFirmAdmin) {
      const first = managersQuery.data?.[0]?.id;
      if (first && managerIds.length === 0) {
        dispatch({ type: 'patch', patch: { managerIds: [first] } });
      }
    }
  }, [canCreate, isFirmAdmin, isManager, selfManagerId, managersQuery.data, managerIds]);

  useEffect(() => {
    if (internIds.length === 0 && defaultInternId) {
      dispatch({ type: 'patch', patch: { internIds: [defaultInternId] } });
    }
  }, [defaultInternId, internIds.length]);

  const emailValid = emailSchema.safeParse(clientEmail).success;
  const passwordValid = clientPasswordSchema.safeParse(clientPassword).success;
  const companyValid = companyNameSchema.safeParse(companyName).success;
  const companyTypeValid = companyTypeSchema.safeParse(companyType).success;
  const entityLegalFormValid = entityLegalFormSchema.safeParse(entityLegalForm).success;
  const parentEntityNameValid = parentEntityNameSchema.safeParse(parentEntityName).success;
  const parentEntityAddressValid = parentEntityAddressSchema.safeParse(parentEntityAddress).success;
  const needsSubsidiary = stageRequiresSubsidiary(stage);
  const subsidiaryNameValid = !needsSubsidiary
    ? true
    : subsidiaryLegalNameSchema.safeParse(subsidiaryLegalName).success;
  const subsidiaryAddressValid = !needsSubsidiary
    ? true
    : subsidiaryRegisteredAddressSchema.safeParse(subsidiaryRegisteredAddress).success;
  const leadsValid = internIds.some((id) => id.trim());
  const managersValid = isFirmAdmin
    ? managerIds.some((id) => id.trim())
    : Boolean(selfManagerId);
  const canSubmit =
    companyValid &&
    companyTypeValid &&
    entityLegalFormValid &&
    parentEntityNameValid &&
    parentEntityAddressValid &&
    subsidiaryNameValid &&
    subsidiaryAddressValid &&
    emailValid &&
    passwordValid &&
    leadsValid &&
    managersValid &&
    canCreate;
  const pwStrength = passwordStrength(clientPassword);

  const fieldErrors = useMemo(
    () => ({
      companyName: !companyName.trim() ? 'Enter the project or GCC entity name for this setup.' : '',
      companyType: !companyTypeValid ? 'Select whether the company is domestic or foreign.' : '',
      parentEntityName: !parentEntityName.trim()
        ? 'Enter the parent entity’s full legal name as on incorporation documents.'
        : !parentEntityNameValid
          ? 'Legal name must be 240 characters or fewer.'
          : '',
      parentEntityAddress: !parentEntityAddress.trim()
        ? 'Enter the parent entity’s full registered address.'
        : !parentEntityAddressValid
          ? 'Address must be 2,000 characters or fewer.'
          : '',
      subsidiaryLegalName: needsSubsidiary
        ? !subsidiaryLegalName.trim()
          ? 'Enter the subsidiary company’s full legal name.'
          : !subsidiaryNameValid
            ? 'Legal name must be 240 characters or fewer.'
            : ''
        : '',
      subsidiaryRegisteredAddress: needsSubsidiary
        ? !subsidiaryRegisteredAddress.trim()
          ? 'Enter the subsidiary company’s registered address.'
          : !subsidiaryAddressValid
            ? 'Address must be 2,000 characters or fewer.'
            : ''
        : '',
      clientEmail: !clientEmail.trim()
        ? 'Client portal email is required.'
        : !emailValid
          ? 'Use a valid work email (e.g. founder@company.in).'
          : '',
      clientPassword: !clientPassword
        ? 'Set the client’s initial portal password.'
        : !passwordValid
          ? 'Use at least 8 characters.'
          : '',
      managerId: isFirmAdmin && !managerIds.some((id) => id.trim())
        ? 'Assign at least one project manager.'
        : '',
      internId: !leadsValid ? 'Assign at least one project lead.' : '',
    }),
    [
      companyName,
      companyTypeValid,
      parentEntityName,
      parentEntityNameValid,
      parentEntityAddress,
      parentEntityAddressValid,
      needsSubsidiary,
      subsidiaryLegalName,
      subsidiaryNameValid,
      subsidiaryRegisteredAddress,
      subsidiaryAddressValid,
      clientEmail,
      emailValid,
      clientPassword,
      passwordValid,
      isFirmAdmin,
      managerIds,
      leadsValid,
    ],
  );

  const fieldError = (key: keyof typeof fieldErrors) => (showValidation ? fieldErrors[key] : '');

  const setCompanyName = (value: string) => dispatch({ type: 'patch', patch: { companyName: value } });
  const setCompanyType = (value: typeof companyType) =>
    dispatch({ type: 'patch', patch: { companyType: value } });
  const setEntityLegalForm = (value: typeof entityLegalForm) =>
    dispatch({ type: 'patch', patch: { entityLegalForm: value } });
  const setParentEntityName = (value: string) =>
    dispatch({ type: 'patch', patch: { parentEntityName: value } });
  const setParentEntityAddress = (value: string) =>
    dispatch({ type: 'patch', patch: { parentEntityAddress: value } });
  const setSubsidiaryLegalName = (value: string) =>
    dispatch({ type: 'patch', patch: { subsidiaryLegalName: value } });
  const setSubsidiaryRegisteredAddress = (value: string) =>
    dispatch({ type: 'patch', patch: { subsidiaryRegisteredAddress: value } });
  const setClientContact = (value: string) =>
    dispatch({ type: 'patch', patch: { clientContact: value } });
  const setClientEmail = (value: string) => dispatch({ type: 'patch', patch: { clientEmail: value } });
  const setClientPassword = (value: string) =>
    dispatch({ type: 'patch', patch: { clientPassword: value } });
  /** Keep selected ids unique; allow a single trailing empty slot while picking. */
  const setInternIds = (value: string[]) => {
    const selected = uniqueNonEmpty(value);
    const hasEmptySlot = value.some((id) => !id.trim());
    dispatch({
      type: 'patch',
      patch: { internIds: hasEmptySlot ? [...selected, ''] : selected },
    });
  };
  const setManagerIds = (value: string[]) => {
    const next = uniqueNonEmpty(value);
    dispatch({
      type: 'patch',
      patch: {
        managerIds:
          isManager && selfManagerId
            ? uniqueNonEmpty([selfManagerId, ...next.filter((id) => id !== selfManagerId)])
            : next,
      },
    });
  };
  const setStage = (value: typeof stage) => dispatch({ type: 'patch', patch: { stage: value } });
  const setShowPassword = (value: boolean) => dispatch({ type: 'patch', patch: { showPassword: value } });

  const defaultManagerIdsAfterReset = () => {
    if (isManager && selfManagerId) return [selfManagerId];
    if (isFirmAdmin && managerIds[0]) return [managerIds[0]];
    return [];
  };

  const submit = async () => {
    dispatch({ type: 'patch', patch: { showValidation: true } });
    const name = companyName.trim();
    const email = clientEmail.trim();
    if (!canSubmit) return;
    dispatch({ type: 'patch', patch: { submitting: true } });
    try {
      const cleanInternIds = uniqueNonEmpty(internIds);
      const cleanManagerIds =
        isManager && selfManagerId
          ? uniqueNonEmpty([selfManagerId, ...managerIds])
          : uniqueNonEmpty(managerIds);
      const result = await createProjectWithClient({
        companyName: name,
        companyType,
        entityLegalForm,
        parentEntityName: parentEntityName.trim(),
        parentEntityAddress: parentEntityAddress.trim(),
        subsidiaryLegalName: needsSubsidiary ? subsidiaryLegalName.trim() : undefined,
        subsidiaryRegisteredAddress: needsSubsidiary
          ? subsidiaryRegisteredAddress.trim()
          : undefined,
        clientEmail: email,
        clientPassword,
        clientName: clientContact.trim() || undefined,
        internIds: cleanInternIds,
        internId: cleanInternIds[0],
        managerIds: cleanManagerIds.length ? cleanManagerIds : undefined,
        managerId: cleanManagerIds[0],
        stage,
        health: 'on-track',
      });
      const { engagement } = result;
      toastSuccess(
        'GCC setup project created',
        `${name} is ready. ${email} can sign in to the client portal.`,
      );
      toastEmailDispatch(
        result.emailSent
          ? { attempted: 1, sent: [email], skipped: [], failed: [] }
          : result.emailSkipped
            ? { attempted: 1, sent: [], skipped: [email], failed: [] }
            : result.emailError
              ? { attempted: 1, sent: [], skipped: [], failed: [email] }
              : undefined,
        { companyName: name, engagementId: engagement.id, href: '#' },
      );
      dispatch({
        type: 'reset',
        internIds: defaultInternId ? [defaultInternId] : [],
        managerIds: defaultManagerIdsAfterReset(),
      });
      clearCreateProjectDraft();
      onCreated?.();
      onSuccess(engagement);
    } catch (err) {
      toastError("Couldn't create project", errorMessage(err, 'Check the fields and try again.'));
    } finally {
      dispatch({ type: 'patch', patch: { submitting: false } });
    }
  };

  const saveDraft = () => {
    saveCreateProjectDraft(state);
    toastSuccess('Draft saved', 'Come back anytime — your answers are waiting on this device.');
  };

  const discard = () => {
    clearCreateProjectDraft();
    dispatch({
      type: 'reset',
      internIds: defaultInternId ? [defaultInternId] : [],
      managerIds: defaultManagerIdsAfterReset(),
    });
    onCancel?.();
  };

  const viewProps = {
    onCancel: discard,
    submitting,
    companyName,
    setCompanyName,
    companyType,
    setCompanyType,
    entityLegalForm,
    setEntityLegalForm,
    parentEntityName,
    setParentEntityName,
    parentEntityAddress,
    setParentEntityAddress,
    subsidiaryLegalName,
    setSubsidiaryLegalName,
    subsidiaryRegisteredAddress,
    setSubsidiaryRegisteredAddress,
    clientContact,
    setClientContact,
    clientEmail,
    setClientEmail,
    clientPassword,
    setClientPassword,
    internIds,
    setInternIds,
    managerIds,
    setManagerIds,
    lockFirstManager: isManager,
    selfManagerId,
    showManagerPicker: isFirmAdmin || isManager,
    managers: managersQuery.data ?? [],
    managersLoading: managersQuery.isLoading,
    stage,
    setStage,
    showPassword,
    setShowPassword,
    owners,
    internsLoading,
    fieldError,
    pwStrength,
    submit,
    saveDraft,
    companyTypeValid,
    canSubmit,
  };
  return <CreateProjectFormView {...viewProps} />;
}
