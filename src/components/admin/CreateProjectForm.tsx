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
} from "@/lib/api/schemas";
import {
  createProjectReducer,
  passwordStrength,
  DEFAULT_CLIENT_TEMP_PASSWORD,
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

function initialCreateProjectState(internId: string): CreateProjectState {
  return {
    companyName: '',
    companyType: 'domestic',
    entityLegalForm: 'company',
    parentEntityName: '',
    parentEntityAddress: '',
    clientContact: '',
    clientEmail: '',
    clientPassword: DEFAULT_CLIENT_TEMP_PASSWORD,
    internId,
    managerId: '',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    submitting: false,
    showValidation: false,
    showPassword: false,
  };
}

export function CreateProjectForm({ onSuccess, onCancel, onCreated }: CreateProjectFormProps) {
  const { createProjectWithClient, internOptions, internsLoading, teamMembers, user } = useApp();
  const owners = internOptions.length ? internOptions : teamMembers;
  const defaultInternId = owners[0]?.id || 'tm1';
  const isFirmAdmin = isFirmWideAdmin(user?.role);
  const canCreate = isAdminOrManager(user?.role);

  const managersQuery = useQuery({
    queryKey: ['admin-managers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/managers');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `http_${res.status}`);
      return (body.managers ?? []) as ManagerOption[];
    },
    enabled: isFirmAdmin,
    staleTime: 5 * 60_000,
  });

  const [state, dispatch] = useReducer(createProjectReducer, defaultInternId, initialCreateProjectState);

  const {
    companyName,
    companyType,
    entityLegalForm,
    parentEntityName,
    parentEntityAddress,
    clientContact,
    clientEmail,
    clientPassword,
    internId,
    managerId,
    stage,
    health,
    submitting,
    showValidation,
    showPassword,
  } = state;

  useEffect(() => {
    if (!isFirmAdmin) return;
    const first = managersQuery.data?.[0]?.id;
    if (first && !managerId) {
      dispatch({ type: 'patch', patch: { managerId: first } });
    }
  }, [isFirmAdmin, managersQuery.data, managerId]);

  const emailValid = emailSchema.safeParse(clientEmail).success;
  const passwordValid = clientPasswordSchema.safeParse(clientPassword).success;
  const companyValid = companyNameSchema.safeParse(companyName).success;
  const companyTypeValid = companyTypeSchema.safeParse(companyType).success;
  const entityLegalFormValid = entityLegalFormSchema.safeParse(entityLegalForm).success;
  const parentEntityNameValid = parentEntityNameSchema.safeParse(parentEntityName).success;
  const parentEntityAddressValid = parentEntityAddressSchema.safeParse(parentEntityAddress).success;
  const managerValid = !isFirmAdmin || Boolean(managerId);
  const canSubmit =
    companyValid &&
    companyTypeValid &&
    entityLegalFormValid &&
    parentEntityNameValid &&
    parentEntityAddressValid &&
    emailValid &&
    passwordValid &&
    managerValid &&
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
      managerId: isFirmAdmin && !managerId ? 'Assign a project manager.' : '',
    }),
    [
      companyName,
      companyTypeValid,
      parentEntityName,
      parentEntityNameValid,
      parentEntityAddress,
      parentEntityAddressValid,
      clientEmail,
      emailValid,
      clientPassword,
      passwordValid,
      isFirmAdmin,
      managerId,
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
  const setClientContact = (value: string) =>
    dispatch({ type: 'patch', patch: { clientContact: value } });
  const setClientEmail = (value: string) => dispatch({ type: 'patch', patch: { clientEmail: value } });
  const setClientPassword = (value: string) =>
    dispatch({ type: 'patch', patch: { clientPassword: value } });
  const setInternId = (value: string) => dispatch({ type: 'patch', patch: { internId: value } });
  const setManagerId = (value: string) => dispatch({ type: 'patch', patch: { managerId: value } });
  const setStage = (value: typeof stage) => dispatch({ type: 'patch', patch: { stage: value } });
  const setHealth = (value: typeof health) => dispatch({ type: 'patch', patch: { health: value } });
  const setShowPassword = (value: boolean) => dispatch({ type: 'patch', patch: { showPassword: value } });

  const submit = async () => {
    dispatch({ type: 'patch', patch: { showValidation: true } });
    const name = companyName.trim();
    const email = clientEmail.trim();
    if (!canSubmit) return;
    dispatch({ type: 'patch', patch: { submitting: true } });
    try {
      const result = await createProjectWithClient({
        companyName: name,
        companyType,
        entityLegalForm,
        parentEntityName: parentEntityName.trim(),
        parentEntityAddress: parentEntityAddress.trim(),
        clientEmail: email,
        clientPassword,
        clientName: clientContact.trim() || undefined,
        internId,
        managerId: isFirmAdmin ? managerId : undefined,
        stage,
        health,
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
      dispatch({ type: 'reset', internId: defaultInternId, managerId: isFirmAdmin ? managerId : '' });
      onCreated?.();
      onSuccess(engagement);
    } catch (err) {
      toastError("Couldn't create project", errorMessage(err, 'Check the fields and try again.'));
    } finally {
      dispatch({ type: 'patch', patch: { submitting: false } });
    }
  };

  const viewProps = {
    onCancel,
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
    clientContact,
    setClientContact,
    clientEmail,
    setClientEmail,
    clientPassword,
    setClientPassword,
    internId,
    setInternId,
    managerId,
    setManagerId,
    showManagerPicker: isFirmAdmin,
    managers: managersQuery.data ?? [],
    managersLoading: managersQuery.isLoading,
    stage,
    setStage,
    health,
    setHealth,
    showPassword,
    setShowPassword,
    owners,
    internsLoading,
    fieldError,
    pwStrength,
    submit,
    companyTypeValid,
    canSubmit,
  };
  return <CreateProjectFormView {...viewProps} />;
}
