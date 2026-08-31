"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import type { Engagement } from "@/data/engagements";
import { CreateProjectFormView } from '@/components/admin/CreateProjectFormSections';
import { ChangeClientDialog } from '@/components/admin/ChangeClientDialog';
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
  uniqueNonEmptyIds,
  reconcileSelectedIds,
  sameIdList,
  isPlaceholderTeamId,
  type CreateProjectState,
} from '@/components/admin/create-project-form-utils';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { normalizeToE164 } from '@/lib/notify/phone';
import { prunedAnswers, type QuestionnaireAnswers } from '@/data/compliance-questionnaire';
import {
  addEngagementLeadInDb,
  listEngagementClientsFromDb,
  removeEngagementLeadInDb,
} from '@/lib/project-admin-db';

export type CreateProjectFormProps = {
  onSuccess: (engagement: Engagement) => void;
  onCancel?: () => void;
  /** Called after successful create so parent can close dialog / reset */
  onCreated?: () => void;
  /** Present = the same form edits this project instead of creating one. */
  editEngagement?: Engagement;
};

type ManagerOption = { id: string; name: string; email: string };

function stateFromEngagement(eng: Engagement): CreateProjectState {
  return {
    companyName: eng.companyName ?? '',
    companyType: (eng.companyType ?? 'domestic') as CreateProjectState['companyType'],
    entityLegalForm: (eng.entityLegalForm ?? 'company') as CreateProjectState['entityLegalForm'],
    parentEntityName: eng.parentEntityName ?? '',
    parentEntityAddress: eng.parentEntityAddress ?? '',
    subsidiaryLegalName: eng.subsidiaryLegalName ?? '',
    subsidiaryRegisteredAddress: eng.subsidiaryRegisteredAddress ?? '',
    clientContact: eng.clientDisplayName ?? '',
    clientPhone: '',
    clientWhatsappConsent: false,
    clientEmail: eng.clientEmail ?? '',
    clientPassword: DEFAULT_CLIENT_TEMP_PASSWORD,
    internIds:
      eng.leadIds && eng.leadIds.length > 0
        ? [...eng.leadIds]
        : eng.internId
          ? [eng.internId]
          : [],
    managerIds: eng.managerId ? [eng.managerId] : [],
    stage: (eng.stage ?? 'Pre-Incorporation') as CreateProjectState['stage'],
    health: (eng.health ?? 'on-track') as CreateProjectState['health'],
    questionnaire: eng.complianceQuestionnaire ?? {},
    submitting: false,
    showValidation: false,
    showPassword: false,
  };
}

function initialCreateProjectState(internIds: string[]): CreateProjectState {
  const base: CreateProjectState = {
    companyName: '',
    companyType: 'domestic',
    entityLegalForm: 'company',
    parentEntityName: '',
    parentEntityAddress: '',
    subsidiaryLegalName: '',
    subsidiaryRegisteredAddress: '',
    clientContact: '',
    clientPhone: '',
    clientWhatsappConsent: false,
    clientEmail: '',
    clientPassword: DEFAULT_CLIENT_TEMP_PASSWORD,
    internIds,
    managerIds: [],
    stage: 'Pre-Incorporation',
    health: 'on-track',
    questionnaire: {},
    submitting: false,
    showValidation: false,
    showPassword: false,
  };
  const draft = loadCreateProjectDraft();
  if (!draft) return base;
  return {
    ...base,
    ...draft,
    internIds: uniqueNonEmptyIds(draft.internIds).filter((id) => !isPlaceholderTeamId(id)),
    managerIds: uniqueNonEmptyIds(draft.managerIds),
    submitting: false,
    showValidation: false,
    showPassword: false,
  };
}

export function CreateProjectForm({
  onSuccess,
  onCancel,
  onCreated,
  editEngagement,
}: CreateProjectFormProps) {
  const { createProjectWithClient, updateEngagement, internOptions, internsLoading, teamMembers, user } = useApp();
  const isEdit = Boolean(editEngagement);
  const [changeClientOpen, setChangeClientOpen] = useState(false);
  const owners = internOptions.length ? internOptions : teamMembers;
  const defaultInternId = owners[0]?.id ?? '';
  const isFirmAdmin = isFirmWideAdmin(user?.role);
  const isManager = user?.role === 'manager';
  const canCreate = isAdminOrManager(user?.role);
  const selfManagerId = user?.id ?? '';

  const clientsQuery = useQuery({
    queryKey: ['engagement-clients', editEngagement?.id ?? 'none'],
    queryFn: () => listEngagementClientsFromDb(editEngagement?.id ?? ''),
    enabled: isEdit && Boolean(editEngagement?.id),
    staleTime: 60_000,
  });
  const existingClient =
    (clientsQuery.data ?? []).find((c) => c.memberRole === 'owner') ??
    (clientsQuery.data ?? [])[0] ??
    null;

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
    [],
    (ids: string[]) =>
      editEngagement ? stateFromEngagement(editEngagement) : initialCreateProjectState(ids),
  );

  const {
    companyName,
    companyType,
    entityLegalForm,
    parentEntityName,
    parentEntityAddress,
    subsidiaryLegalName,
    subsidiaryRegisteredAddress,
    clientContact,
    clientPhone,
    clientWhatsappConsent,
    clientEmail,
    clientPassword,
    internIds,
    managerIds,
    stage,
    questionnaire,
    submitting,
    showValidation,
    showPassword,
  } = state;

  useEffect(() => {
    if (!canCreate || isEdit) return;
    if (isManager && selfManagerId) {
      const next = uniqueNonEmptyIds([selfManagerId, ...managerIds]);
      if (!sameIdList(next, managerIds)) {
        dispatch({ type: 'patch', patch: { managerIds: next } });
      }
      return;
    }
    const available = (managersQuery.data ?? []).map((m) => m.id);
    if (!isFirmAdmin || available.length === 0) return;
    const next = reconcileSelectedIds(managerIds, available);
    if (!sameIdList(next, managerIds)) {
      dispatch({ type: 'patch', patch: { managerIds: next } });
    }
  }, [canCreate, isEdit, isFirmAdmin, isManager, selfManagerId, managersQuery.data, managerIds]);

  useEffect(() => {
    if (isEdit) return;
    const available = owners.map((o) => o.id).filter(Boolean);
    if (available.length === 0 && internIds.length === 0) return;
    const next = reconcileSelectedIds(internIds, available);
    if (!sameIdList(next, internIds)) {
      dispatch({ type: 'patch', patch: { internIds: next } });
    }
  }, [isEdit, owners, internIds]);

  const emailValid = isEdit || emailSchema.safeParse(clientEmail).success;
  const passwordValid = isEdit || clientPasswordSchema.safeParse(clientPassword).success;
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
  const leadsValid = internIds.some((id) => owners.some((o) => o.id === id));
  const managersValid = isFirmAdmin
    ? managerIds.some((id) => (managersQuery.data ?? []).some((m) => m.id === id))
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
    canCreate &&
    !internsLoading;
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
      clientEmail: isEdit
        ? ''
        : !clientEmail.trim()
          ? 'Client portal email is required.'
          : !emailValid
            ? 'Use a valid work email (e.g. founder@company.in).'
            : '',
      clientPassword: isEdit
        ? ''
        : !clientPassword
          ? 'Set the client’s initial portal password.'
          : !passwordValid
            ? 'Use at least 8 characters.'
            : '',
      internId:
        !owners.length && !internsLoading
          ? 'No project leads available. Add a project lead in People first.'
          : !leadsValid
            ? 'Assign at least one project lead.'
            : '',
      managerId:
        isFirmAdmin &&
        !managerIds.some((id) => (managersQuery.data ?? []).some((m) => m.id === id))
          ? managersQuery.isLoading
            ? 'Loading project managers…'
            : 'Assign at least one project manager.'
          : '',
    }),
    [
      isEdit,
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
      managersQuery.data,
      managersQuery.isLoading,
      leadsValid,
      owners,
      internsLoading,
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
  const setClientPhone = (value: string) =>
    dispatch({ type: 'patch', patch: { clientPhone: value } });
  const setClientWhatsappConsent = (value: boolean) =>
    dispatch({ type: 'patch', patch: { clientWhatsappConsent: value } });
  const setClientEmail = (value: string) => dispatch({ type: 'patch', patch: { clientEmail: value } });
  const setClientPassword = (value: string) =>
    dispatch({ type: 'patch', patch: { clientPassword: value } });
  /** Keep selected ids unique; allow a single trailing empty slot while picking. */
  const setInternIds = (value: string[]) => {
    const selected = uniqueNonEmptyIds(value);
    const hasEmptySlot = value.some((id) => !id.trim());
    dispatch({
      type: 'patch',
      patch: { internIds: hasEmptySlot ? [...selected, ''] : selected },
    });
  };
  const setManagerIds = (value: string[]) => {
    const next = uniqueNonEmptyIds(value);
    dispatch({
      type: 'patch',
      patch: {
        managerIds:
          isManager && selfManagerId
            ? uniqueNonEmptyIds([selfManagerId, ...next.filter((id) => id !== selfManagerId)])
            : next,
      },
    });
  };
  const setStage = (value: typeof stage) => dispatch({ type: 'patch', patch: { stage: value } });
  const setQuestionnaire = (value: QuestionnaireAnswers) =>
    dispatch({ type: 'patch', patch: { questionnaire: value } });
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
      const cleanInternIds = uniqueNonEmptyIds(internIds).filter((id) =>
        owners.some((o) => o.id === id),
      );

      if (isEdit && editEngagement) {
        const needsSub = stageRequiresSubsidiary(stage);
        const managerChanged =
          isFirmAdmin && (editEngagement.managerId ?? '') !== (uniqueNonEmptyIds(managerIds)[0] ?? '');
        const updated = await updateEngagement(editEngagement.id, {
          companyName: name,
          companyType,
          entityLegalForm,
          parentEntityName: parentEntityName.trim(),
          parentEntityAddress: parentEntityAddress.trim(),
          subsidiaryLegalName: needsSub ? subsidiaryLegalName.trim() : null,
          subsidiaryRegisteredAddress: needsSub ? subsidiaryRegisteredAddress.trim() : null,
          clientName: clientContact.trim() || null,
          stage,
          ...(cleanInternIds[0] ? { internId: cleanInternIds[0] } : {}),
          ...(managerChanged ? { managerId: uniqueNonEmptyIds(managerIds)[0] ?? null } : {}),
          complianceQuestionnaire: prunedAnswers(questionnaire) as Record<
            string,
            boolean | number | string
          >,
        });

        // Delivery team diff — adds first so the project never drops to zero leads.
        const before = new Set(
          editEngagement.leadIds?.length
            ? editEngagement.leadIds
            : editEngagement.internId
              ? [editEngagement.internId]
              : [],
        );
        const after = new Set(cleanInternIds);
        for (const id of after) {
          if (!before.has(id)) await addEngagementLeadInDb(editEngagement.id, id);
        }
        for (const id of before) {
          if (!after.has(id)) {
            await removeEngagementLeadInDb(editEngagement.id, id).catch(() => undefined);
          }
        }

        toastSuccess('Project updated', name);
        onCreated?.();
        onSuccess(updated ?? editEngagement);
        return;
      }
      const managerRoster = managersQuery.data ?? [];
      const cleanManagerIds = uniqueNonEmptyIds(
        isManager && selfManagerId ? [selfManagerId, ...managerIds] : managerIds,
      ).filter((id) =>
        isManager && id === selfManagerId
          ? true
          : managerRoster.length === 0
            ? Boolean(id)
            : managerRoster.some((m) => m.id === id),
      );
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
        // Normalised here so the API only ever sees E.164; an unparseable
        // number is dropped rather than guessed at.
        ...(normalizeToE164(clientPhone)
          ? { clientPhoneE164: normalizeToE164(clientPhone) as string }
          : {}),
        clientWhatsappConsent: clientWhatsappConsent && Boolean(normalizeToE164(clientPhone)),
        internIds: cleanInternIds,
        internId: cleanInternIds[0],
        managerIds: cleanManagerIds.length ? cleanManagerIds : undefined,
        managerId: cleanManagerIds[0],
        stage,
        health: 'on-track',
        complianceQuestionnaire: prunedAnswers(questionnaire) as Record<
          string,
          boolean | number | string
        >,
      });
      const { engagement } = result;
      toastSuccess(
        'GCC setup project created',
        `${name} is ready. ${email} can sign in to the client portal.`,
      );
      toastEmailDispatch(
        result.email ??
          (result.emailSent
            ? {
                attempted: 1,
                sent: [email],
                skipped: [],
                failed: [],
                subjects: [`Welcome to VCFO Suite — ${name}`],
              }
            : result.emailSkipped
              ? {
                  attempted: 1,
                  sent: [],
                  skipped: [email],
                  failed: [],
                  subjects: [`Welcome to VCFO Suite — ${name}`],
                }
              : result.emailError
                ? {
                    attempted: 1,
                    sent: [],
                    skipped: [],
                    failed: [email],
                    subjects: [`Welcome to VCFO Suite — ${name}`],
                  }
                : undefined),
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
    toastSuccess('Draft saved');
  };

  const discard = () => {
    if (isEdit) {
      onCancel?.();
      return;
    }
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
    clientPhone,
    setClientPhone,
    clientWhatsappConsent,
    setClientWhatsappConsent,
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
    questionnaire,
    setQuestionnaire,
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
    editMode: isEdit,
    existingClientEmail: existingClient?.email ?? editEngagement?.clientEmail ?? '',
    onChangeClientEmail: () => setChangeClientOpen(true),
    canChangeClientEmail: isEdit && (isFirmAdmin || isManager),
    changeClientNeedsApproval: !isFirmAdmin,
  };
  return (
    <>
      <CreateProjectFormView {...viewProps} />
      {isEdit && editEngagement ? (
        <ChangeClientDialog
          engagement={editEngagement}
          open={changeClientOpen}
          onOpenChange={setChangeClientOpen}
          mode={isFirmAdmin ? 'direct' : 'request'}
          onDone={() => {
            void clientsQuery.refetch();
          }}
        />
      ) : null}
    </>
  );
}
