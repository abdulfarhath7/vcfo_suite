'use client';

/**
 * Create / edit project — the live form's logic (src/components/admin/
 * CreateProjectForm.tsx), carried over unchanged into a hook, with the
 * console's own fields. Same reducer, same schemas, same rules, same API
 * calls: ownership (Subsidiary / Standalone), subsidiary type, the Indian
 * parent's role, the starting phase, the parent entity when the starting phase
 * skips SPICe+ Part A, the subsidiary's details for Registration / Compliance
 * starts, the legal form, managers (a manager is always the first, locked),
 * leads (first is primary), the client portal sign-in, WhatsApp consent
 * (never pre-ticked), the optional compliance questionnaire, drafts in the
 * browser, and on edit the delivery-team diff and the change-client request.
 */
import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { requiresParentIndianRelationship } from '@/data/engagements';
import { prunedAnswers, questionnaireProgress, type QuestionnaireAnswers } from '@/data/compliance-questionnaire';
import { CreateProjectQuestionnaire } from '@/components/admin/CreateProjectQuestionnaire';
import { IncorporationDocxPreview } from '@/components/incorporation/IncorporationDocxPreview';
import {
  clearCreateProjectDraft,
  COMPANY_TYPES,
  createProjectReducer,
  DEFAULT_CLIENT_TEMP_PASSWORD,
  ENTITY_LEGAL_FORMS,
  isPlaceholderTeamId,
  loadCreateProjectDraft,
  OWNERSHIP_TYPES,
  PARENT_INDIAN_RELATIONSHIP_REQUIRED_MESSAGE,
  PARENT_INDIAN_RELATIONSHIPS,
  parentIndianRelationshipForSubmit,
  parentIndianRelationshipMissing,
  passwordStrength,
  PHASE_ORDER,
  reconcileSelectedIds,
  sameIdList,
  saveCreateProjectDraft,
  STAGE_LABEL,
  stageRequiresParentEntity,
  stageRequiresSubsidiary,
  uniqueNonEmptyIds,
  type CreateProjectState,
} from '@/components/admin/create-project-form-utils';
import {
  clientPasswordSchema,
  companyNameSchema,
  companyTypeSchema,
  emailSchema,
  entityLegalFormSchema,
  parentEntityAddressSchema,
  parentEntityNameSchema,
  subsidiaryLegalNameSchema,
  subsidiaryRegisteredAddressSchema,
} from '@/lib/api/schemas';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { normalizeToE164 } from '@/lib/notify/phone';
import { NOC_TEMPLATES, nocTemplatePreviewUrl } from '@/lib/noc/templates';
import { resolveNocVariant } from '@/lib/noc/variant';
import { addEngagementLeadInDb, listEngagementClientsFromDb, removeEngagementLeadInDb } from '@/lib/projects/project-admin-db';
import { errorMessage, toastEmailDispatch } from '@/lib/toast-errors';
import type { CreateProjectResult } from '@/lib/projects/engagements-db';
import { useConsole } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, Icon, Seg } from '../../ui';
import { Island } from './shared';

type ManagerOption = { id: string; name: string; email: string };

/* ---------------------------------------------------------------- the live form's state (copied) */

function stateFromEngagement(eng: Engagement): CreateProjectState {
  return {
    companyName: eng.companyName ?? '',
    ownershipType: eng.ownershipType ?? 'subsidiary',
    companyType: (eng.companyType ?? 'domestic') as CreateProjectState['companyType'],
    parentIndianRelationship: eng.parentIndianRelationship ?? null,
    entityLegalForm: (eng.entityLegalForm ?? 'company') as CreateProjectState['entityLegalForm'],
    subsidiaryLegalName: eng.subsidiaryLegalName ?? '',
    subsidiaryRegisteredAddress: eng.subsidiaryRegisteredAddress ?? '',
    parentEntityName: eng.parentEntityName ?? '',
    parentEntityAddress: eng.parentEntityAddress ?? '',
    clientContact: eng.clientDisplayName ?? '',
    clientPhone: '',
    clientWhatsappConsent: false,
    clientEmail: eng.clientEmail ?? '',
    clientPassword: DEFAULT_CLIENT_TEMP_PASSWORD,
    internIds: eng.leadIds && eng.leadIds.length > 0 ? [...eng.leadIds] : eng.internId ? [eng.internId] : [],
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
    ownershipType: 'subsidiary',
    companyType: 'domestic',
    parentIndianRelationship: null,
    entityLegalForm: 'company',
    subsidiaryLegalName: '',
    subsidiaryRegisteredAddress: '',
    parentEntityName: '',
    parentEntityAddress: '',
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

export type ProjectFieldKey =
  | 'companyName'
  | 'companyType'
  | 'parentIndianRelationship'
  | 'subsidiaryLegalName'
  | 'subsidiaryRegisteredAddress'
  | 'parentEntityName'
  | 'parentEntityAddress'
  | 'clientEmail'
  | 'clientPassword'
  | 'internId'
  | 'managerId';

export function useProjectForm(editEngagement?: Engagement) {
  const { createProjectWithClient, updateEngagement, internOptions, internsLoading, teamMembers, user } = useApp();
  const isEdit = Boolean(editEngagement);
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
  const existingClient = (clientsQuery.data ?? []).find((c) => c.memberRole === 'owner') ?? (clientsQuery.data ?? [])[0] ?? null;

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

  const [state, dispatch] = useReducer(createProjectReducer, [], (ids: string[]) =>
    editEngagement ? stateFromEngagement(editEngagement) : initialCreateProjectState(ids),
  );
  const patch = (p: Partial<CreateProjectState>) => dispatch({ type: 'patch', patch: p });

  useEffect(() => {
    if (!canCreate || isEdit) return;
    if (isManager && selfManagerId) {
      const next = uniqueNonEmptyIds([selfManagerId, ...state.managerIds]);
      if (!sameIdList(next, state.managerIds)) dispatch({ type: 'patch', patch: { managerIds: next } });
      return;
    }
    const available = (managersQuery.data ?? []).map((m) => m.id);
    if (!isFirmAdmin || available.length === 0) return;
    const next = reconcileSelectedIds(state.managerIds, available);
    if (!sameIdList(next, state.managerIds)) dispatch({ type: 'patch', patch: { managerIds: next } });
  }, [canCreate, isEdit, isFirmAdmin, isManager, selfManagerId, managersQuery.data, state.managerIds]);

  useEffect(() => {
    if (isEdit) return;
    const available = owners.map((o) => o.id).filter(Boolean);
    if (available.length === 0 && state.internIds.length === 0) return;
    const next = reconcileSelectedIds(state.internIds, available);
    if (!sameIdList(next, state.internIds)) dispatch({ type: 'patch', patch: { internIds: next } });
  }, [isEdit, owners, state.internIds]);

  const s = state;
  const emailValid = isEdit || emailSchema.safeParse(s.clientEmail).success;
  const passwordValid = isEdit || clientPasswordSchema.safeParse(s.clientPassword).success;
  const companyValid = companyNameSchema.safeParse(s.companyName).success;
  const companyTypeValid = companyTypeSchema.safeParse(s.companyType).success;
  const entityLegalFormValid = entityLegalFormSchema.safeParse(s.entityLegalForm).success;
  const independent = s.ownershipType === 'independent';
  const parentRoleValid = !parentIndianRelationshipMissing(s);
  const needsSubsidiary = stageRequiresSubsidiary(s.stage, s.ownershipType);
  const subsidiaryNameValid = !needsSubsidiary || subsidiaryLegalNameSchema.safeParse(s.subsidiaryLegalName).success;
  const subsidiaryAddressValid = !needsSubsidiary || subsidiaryRegisteredAddressSchema.safeParse(s.subsidiaryRegisteredAddress).success;
  const needsParent = stageRequiresParentEntity(s.stage, s.ownershipType);
  const parentNameValid = !needsParent || parentEntityNameSchema.safeParse(s.parentEntityName).success;
  const parentAddressValid = !needsParent || parentEntityAddressSchema.safeParse(s.parentEntityAddress).success;
  const leadsValid = s.internIds.some((id) => owners.some((o) => o.id === id));
  const managersValid = isFirmAdmin ? s.managerIds.some((id) => (managersQuery.data ?? []).some((m) => m.id === id)) : Boolean(selfManagerId);
  const entityValid = companyValid && companyTypeValid && parentRoleValid && entityLegalFormValid && subsidiaryNameValid && subsidiaryAddressValid && parentNameValid && parentAddressValid;
  const teamValid = leadsValid && managersValid;
  const clientValid = emailValid && passwordValid;
  const canSubmit = entityValid && teamValid && clientValid && canCreate && !internsLoading;

  const fieldErrors: Record<ProjectFieldKey, string> = useMemo(
    () => ({
      companyName: !s.companyName.trim() ? 'Enter the project or GCC entity name for this setup.' : '',
      companyType: !companyTypeValid ? 'Select whether it is a foreign or Indian subsidiary.' : '',
      parentIndianRelationship: !parentRoleValid ? PARENT_INDIAN_RELATIONSHIP_REQUIRED_MESSAGE : '',
      subsidiaryLegalName: needsSubsidiary
        ? !s.subsidiaryLegalName.trim()
          ? 'Enter the subsidiary company’s full legal name.'
          : !subsidiaryNameValid
            ? 'Legal name must be 240 characters or fewer.'
            : ''
        : '',
      subsidiaryRegisteredAddress: needsSubsidiary
        ? !s.subsidiaryRegisteredAddress.trim()
          ? 'Enter the subsidiary company’s registered address.'
          : !subsidiaryAddressValid
            ? 'Address must be 2,000 characters or fewer.'
            : ''
        : '',
      parentEntityName: needsParent
        ? !s.parentEntityName.trim()
          ? 'Enter the parent entity’s full legal name.'
          : !parentNameValid
            ? 'Legal name must be 240 characters or fewer.'
            : ''
        : '',
      parentEntityAddress: needsParent
        ? !s.parentEntityAddress.trim()
          ? 'Enter the parent entity’s registered address.'
          : !parentAddressValid
            ? 'Address must be 2,000 characters or fewer.'
            : ''
        : '',
      clientEmail: isEdit ? '' : !s.clientEmail.trim() ? 'Client portal email is required.' : !emailValid ? 'Use a valid work email (e.g. founder@company.in).' : '',
      clientPassword: isEdit ? '' : !s.clientPassword ? 'Set the client’s initial portal password.' : !passwordValid ? 'Use at least 8 characters.' : '',
      internId: !owners.length && !internsLoading ? 'No project leads available. Add a project lead in People first.' : !leadsValid ? 'Assign at least one project lead.' : '',
      managerId:
        isFirmAdmin && !s.managerIds.some((id) => (managersQuery.data ?? []).some((m) => m.id === id))
          ? managersQuery.isLoading
            ? 'Loading project managers…'
            : 'Assign at least one project manager.'
          : '',
    }),
    [s, isEdit, companyTypeValid, parentRoleValid, needsSubsidiary, subsidiaryNameValid, subsidiaryAddressValid, needsParent, parentNameValid, parentAddressValid, emailValid, passwordValid, isFirmAdmin, managersQuery.data, managersQuery.isLoading, leadsValid, owners, internsLoading],
  );
  const fieldError = (key: ProjectFieldKey) => (s.showValidation ? fieldErrors[key] : '');

  /** Keep selected ids unique; allow a single trailing empty slot while picking. */
  const setInternIds = (value: string[]) => {
    const selected = uniqueNonEmptyIds(value);
    const hasEmptySlot = value.some((id) => !id.trim());
    patch({ internIds: hasEmptySlot ? [...selected, ''] : selected });
  };
  const setManagerIds = (value: string[]) => {
    const next = uniqueNonEmptyIds(value);
    patch({ managerIds: isManager && selfManagerId ? uniqueNonEmptyIds([selfManagerId, ...next.filter((id) => id !== selfManagerId)]) : next });
  };
  // A standalone company has no overseas parent: origin snaps to domestic.
  const setOwnershipType = (value: CreateProjectState['ownershipType']) =>
    patch({ ownershipType: value, ...(value === 'independent' ? { companyType: 'domestic' as const } : {}) });

  const defaultManagerIdsAfterReset = () => {
    if (isManager && selfManagerId) return [selfManagerId];
    if (isFirmAdmin && s.managerIds[0]) return [s.managerIds[0]];
    return [];
  };

  /**
   * The live submit. Create → `createProjectWithClient` (the welcome email
   * dispatch is reported as before); edit → `updateEngagement` then the
   * delivery-team diff (adds first, so the project never drops to zero leads).
   */
  const submit = async (): Promise<{ engagement: Engagement; result?: CreateProjectResult } | null> => {
    patch({ showValidation: true });
    const name = s.companyName.trim();
    const email = s.clientEmail.trim();
    if (!canSubmit) return null;
    patch({ submitting: true });
    try {
      const cleanInternIds = uniqueNonEmptyIds(s.internIds).filter((id) => owners.some((o) => o.id === id));
      if (isEdit && editEngagement) {
        const needsSub = stageRequiresSubsidiary(s.stage, s.ownershipType);
        const managerChanged = isFirmAdmin && (editEngagement.managerId ?? '') !== (uniqueNonEmptyIds(s.managerIds)[0] ?? '');
        const updated = await updateEngagement(editEngagement.id, {
          companyName: name,
          ownershipType: s.ownershipType,
          companyType: independent ? 'domestic' : s.companyType,
          parentIndianRelationship: parentIndianRelationshipForSubmit(s),
          entityLegalForm: s.entityLegalForm,
          subsidiaryLegalName: needsSub ? s.subsidiaryLegalName.trim() : null,
          subsidiaryRegisteredAddress: needsSub ? s.subsidiaryRegisteredAddress.trim() : null,
          ...(needsParent ? { parentEntityName: s.parentEntityName.trim(), parentEntityAddress: s.parentEntityAddress.trim() } : {}),
          clientName: s.clientContact.trim() || null,
          stage: s.stage,
          ...(cleanInternIds[0] ? { internId: cleanInternIds[0] } : {}),
          ...(managerChanged ? { managerId: uniqueNonEmptyIds(s.managerIds)[0] ?? null } : {}),
          complianceQuestionnaire: prunedAnswers(s.questionnaire) as Record<string, boolean | number | string>,
        });
        const before = new Set(editEngagement.leadIds?.length ? editEngagement.leadIds : editEngagement.internId ? [editEngagement.internId] : []);
        const after = new Set(cleanInternIds);
        for (const id of after) if (!before.has(id)) await addEngagementLeadInDb(editEngagement.id, id);
        for (const id of before) if (!after.has(id)) await removeEngagementLeadInDb(editEngagement.id, id).catch(() => undefined);
        return { engagement: updated ?? editEngagement };
      }
      const managerRoster = managersQuery.data ?? [];
      const cleanManagerIds = uniqueNonEmptyIds(isManager && selfManagerId ? [selfManagerId, ...s.managerIds] : s.managerIds).filter((id) =>
        isManager && id === selfManagerId ? true : managerRoster.length === 0 ? Boolean(id) : managerRoster.some((m) => m.id === id),
      );
      const result = await createProjectWithClient({
        companyName: name,
        ownershipType: s.ownershipType,
        companyType: independent ? 'domestic' : s.companyType,
        parentIndianRelationship: parentIndianRelationshipForSubmit(s),
        entityLegalForm: s.entityLegalForm,
        subsidiaryLegalName: needsSubsidiary ? s.subsidiaryLegalName.trim() : undefined,
        subsidiaryRegisteredAddress: needsSubsidiary ? s.subsidiaryRegisteredAddress.trim() : undefined,
        ...(needsParent ? { parentEntityName: s.parentEntityName.trim(), parentEntityAddress: s.parentEntityAddress.trim() } : {}),
        clientEmail: email,
        clientPassword: s.clientPassword,
        clientName: s.clientContact.trim() || undefined,
        ...(normalizeToE164(s.clientPhone) ? { clientPhoneE164: normalizeToE164(s.clientPhone) as string } : {}),
        clientWhatsappConsent: s.clientWhatsappConsent && Boolean(normalizeToE164(s.clientPhone)),
        internIds: cleanInternIds,
        internId: cleanInternIds[0],
        managerIds: cleanManagerIds.length ? cleanManagerIds : undefined,
        managerId: cleanManagerIds[0],
        stage: s.stage,
        health: 'on-track',
        complianceQuestionnaire: prunedAnswers(s.questionnaire) as Record<string, boolean | number | string>,
      });
      const { engagement } = result;
      toastEmailDispatch(
        result.email ??
          (result.emailSent
            ? { attempted: 1, sent: [email], skipped: [], failed: [], subjects: [`Welcome to VCFO Suite — ${name}`] }
            : result.emailSkipped
              ? { attempted: 1, sent: [], skipped: [email], failed: [], subjects: [`Welcome to VCFO Suite — ${name}`] }
              : result.emailError
                ? { attempted: 1, sent: [], skipped: [], failed: [email], subjects: [`Welcome to VCFO Suite — ${name}`] }
                : undefined),
        { companyName: name, engagementId: engagement.id, href: '#' },
      );
      dispatch({ type: 'reset', internIds: defaultInternId ? [defaultInternId] : [], managerIds: defaultManagerIdsAfterReset() });
      clearCreateProjectDraft();
      return { engagement, result };
    } catch (err) {
      throw new Error(errorMessage(err, isEdit ? 'Check the fields and try again.' : 'Check the fields and try again.'));
    } finally {
      patch({ submitting: false });
    }
  };

  const saveDraft = () => saveCreateProjectDraft(s);
  const discardDraft = () => {
    clearCreateProjectDraft();
    dispatch({ type: 'reset', internIds: defaultInternId ? [defaultInternId] : [], managerIds: defaultManagerIdsAfterReset() });
  };

  return {
    s,
    patch,
    dispatch,
    isEdit,
    owners,
    internsLoading,
    managers: managersQuery.data ?? [],
    managersLoading: managersQuery.isLoading,
    isFirmAdmin,
    isManager,
    selfManagerId,
    showManagerPicker: isFirmAdmin || isManager,
    lockFirstManager: isManager,
    independent,
    needsSubsidiary,
    needsParent,
    needsParentRole: requiresParentIndianRelationship(s),
    nocVariant: resolveNocVariant(s),
    valid: { entity: entityValid, team: teamValid, client: clientValid, all: canSubmit },
    fieldError,
    fieldErrors,
    setInternIds,
    setManagerIds,
    setOwnershipType,
    submit,
    saveDraft,
    discardDraft,
    existingClientEmail: existingClient?.email ?? editEngagement?.clientEmail ?? '',
    refetchClients: () => void clientsQuery.refetch(),
    pwStrength: passwordStrength(s.clientPassword),
    questionnaireDone: questionnaireProgress(s.questionnaire).complete,
  };
}

export type ProjectForm = ReturnType<typeof useProjectForm>;

/* ---------------------------------------------------------------- console fields */

export function PField({ label, error, hint, children, req, cls }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; req?: boolean; cls?: string }) {
  return (
    <label className={'mx-f np-f' + (error ? ' bad' : '') + (cls ? ' ' + cls : '')}>
      <span className="mx-fl">
        {label}
        {req ? <span className="cx-req" aria-hidden="true"> *</span> : null}
      </span>
      {children}
      {error ? <span className="np-err">{error}</span> : hint ? <span className="mx-fh">{hint}</span> : null}
    </label>
  );
}

/** A labelled segmented control that is not a single <label> (a group of buttons). */
export function PChoice({ label, error, hint, children, req }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; req?: boolean }) {
  return (
    <div className={'mx-f np-f' + (error ? ' bad' : '')} role="group" aria-label={label}>
      <span className="mx-fl">
        {label}
        {req ? <span className="cx-req" aria-hidden="true"> *</span> : null}
      </span>
      {children}
      {error ? <span className="np-err">{error}</span> : hint ? <span className="mx-fh">{hint}</span> : null}
    </div>
  );
}

function Sh({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="np-sh">
      <h4>{title}</h4>
      {sub ? <span className="small">{sub}</span> : null}
    </div>
  );
}

function ParentNocLine({ variant }: { variant: NonNullable<ProjectForm['nocVariant']> }) {
  const { openModal } = useConsole();
  const def = NOC_TEMPLATES[variant];
  const url = nocTemplatePreviewUrl(variant);
  const short = def.label.replace(/^NOC — /, '');
  return (
    <div className="cx-nocline2">
      <span className="small">
        {`Parent's NOC: ${short}`}
        {url ? '' : ' · template not provided yet'}
      </span>
      {url ? (
        <Btn
          cls="sm"
          ico="eye"
          onClick={() =>
            openModal(
              <ModalBody title={def.label} sub="The firm's blank template, picked from the ownership answers. The Pre-2 board resolution fills it in from the Name Application answers.">
                <Island cls="cx-docv">
                  <IncorporationDocxPreview downloadUrl={url} previewLabel={def.label} refreshKey={variant} />
                </Island>
              </ModalBody>,
              { cls: 'wide cx-docm', label: def.label },
            )
          }
        >
          Preview template
        </Btn>
      ) : null}
    </div>
  );
}

export function EntityFields({ p }: { p: ProjectForm }) {
  const { s, patch, fieldError } = p;
  return (
    <>
      <PField label="Project name" req error={fieldError('companyName')} hint="The name the team and the client see, for example ABC India GCC">
        <input className="mx-in" value={s.companyName} maxLength={120} placeholder="e.g. ABC India GCC" onChange={(e) => patch({ companyName: e.target.value })} />
      </PField>
      <PChoice label="Ownership" req hint={`${OWNERSHIP_TYPES.find((o) => o.value === s.ownershipType)?.hint}${p.independent ? ' — no parent or subsidiary details are asked.' : '.'}`}>
        <Seg className="np-seg" ariaLabel="Ownership" value={s.ownershipType} onChange={p.setOwnershipType} options={OWNERSHIP_TYPES.map((o) => ({ value: o.value, label: o.label }))} />
      </PChoice>
      {p.independent ? null : (
        <PChoice label="Subsidiary type" req error={fieldError('companyType')} hint={COMPANY_TYPES.find((o) => o.value === s.companyType)?.hint}>
          <Seg className="np-seg" ariaLabel="Subsidiary type" value={s.companyType} onChange={(v) => patch({ companyType: v })} options={COMPANY_TYPES.map((o) => ({ value: o.value, label: o.label }))} />
        </PChoice>
      )}
      {p.needsParentRole ? (
        <PChoice
          label="Parent's role"
          req
          error={fieldError('parentIndianRelationship')}
          hint={s.parentIndianRelationship ? PARENT_INDIAN_RELATIONSHIPS.find((o) => o.value === s.parentIndianRelationship)?.hint : 'Does the Indian parent only lend its name, or invest?'}
        >
          <Seg
            className="np-seg"
            ariaLabel="Parent's role"
            value={(s.parentIndianRelationship ?? '') as 'name_only' | 'investing'}
            onChange={(v) => patch({ parentIndianRelationship: v })}
            options={PARENT_INDIAN_RELATIONSHIPS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </PChoice>
      ) : null}
      {p.nocVariant ? <ParentNocLine variant={p.nocVariant} /> : null}
      <PChoice label="Where should work start?" req hint={s.stage === 'Pre-Incorporation' ? 'Incorporation: the registered office NOC is generated with the project.' : undefined}>
        <Seg className="np-seg" ariaLabel="Where should work start" value={s.stage} onChange={(v) => patch({ stage: v })} options={PHASE_ORDER.map((ph) => ({ value: ph, label: STAGE_LABEL[ph] }))} />
      </PChoice>
      {!p.needsParent && !p.independent ? (
        <p className="small cx-infoline">Parent entity details are entered by the client in SPICe+ Part A (Foreign Entity tab) and copied here when they submit.</p>
      ) : null}
      {p.needsParent ? (
        <>
          <Sh title="Parent entity details" sub="The company that owns this subsidiary. There is no SPICe+ Part A at this starting phase, so the parent is named here." />
          <PField label="Parent entity legal name" req error={fieldError('parentEntityName')}>
            <input className="mx-in" value={s.parentEntityName} maxLength={240} placeholder="e.g. ABC Holdings Inc." onChange={(e) => patch({ parentEntityName: e.target.value })} />
          </PField>
          <PField label="Parent entity registered address" req error={fieldError('parentEntityAddress')}>
            <textarea className="mx-in" rows={3} maxLength={2000} value={s.parentEntityAddress} placeholder={'e.g. 100 Main Street\nSalt Lake City, Utah 84101\nUnited States of America'} onChange={(e) => patch({ parentEntityAddress: e.target.value })} />
          </PField>
        </>
      ) : null}
      {p.needsSubsidiary ? (
        <>
          <Sh title="Subsidiary company details" />
          <PField label="Subsidiary company legal name" req error={fieldError('subsidiaryLegalName')}>
            <input className="mx-in" value={s.subsidiaryLegalName} maxLength={240} placeholder="e.g. ABC India Private Limited" onChange={(e) => patch({ subsidiaryLegalName: e.target.value })} />
          </PField>
          <PField label="Subsidiary company registered address" req error={fieldError('subsidiaryRegisteredAddress')}>
            <textarea className="mx-in" rows={3} maxLength={2000} value={s.subsidiaryRegisteredAddress} placeholder={'e.g. 12th Floor, Prestige Tech Park\nOuter Ring Road, Bangalore 560103\nKarnataka, India'} onChange={(e) => patch({ subsidiaryRegisteredAddress: e.target.value })} />
          </PField>
        </>
      ) : null}
      <PChoice label="Entity legal form" req hint={ENTITY_LEGAL_FORMS.find((o) => o.value === s.entityLegalForm)?.hint}>
        <Seg className="np-seg" ariaLabel="Entity legal form" value={s.entityLegalForm} onChange={(v) => patch({ entityLegalForm: v })} options={ENTITY_LEGAL_FORMS.map((o) => ({ value: o.value, label: o.label }))} />
      </PChoice>
    </>
  );
}

export function TeamFields({ p }: { p: ProjectForm }) {
  const { s, fieldError, managers, owners } = p;
  const lockedManager =
    p.lockFirstManager && p.selfManagerId ? (managers.find((m) => m.id === p.selfManagerId) ?? { id: p.selfManagerId, name: 'You', email: '' }) : null;
  const managerSlots = s.managerIds.length ? s.managerIds : [''];
  const leadSlots = s.internIds.length ? s.internIds : [''];
  const canAddManager = p.showManagerPicker && !s.managerIds.some((id) => !id.trim()) && managers.some((m) => !s.managerIds.includes(m.id));
  const canAddLead = !s.internIds.some((id) => !id.trim()) && owners.some((o) => !s.internIds.filter((id) => id.trim()).includes(o.id));
  return (
    <div className={p.showManagerPicker ? 'np-g2 cx-team' : 'cx-team'}>
      {p.showManagerPicker ? (
        <div className="mx-f np-f" role="group" aria-label="Project managers">
          <span className="mx-fl">
            {`Project manager${s.managerIds.length > 1 ? 's' : ''}`}
            <span className="cx-req" aria-hidden="true"> *</span>
          </span>
          {managerSlots.map((id, i) => {
            const locked = p.lockFirstManager && i === 0;
            if (locked)
              return (
                <div key={`m-${i}`} className="np-fixed" title="You manage the projects you create">
                  {`${lockedManager?.name ?? 'You'} (you)`}
                  {lockedManager?.email ? <span className="small"> · {lockedManager.email}</span> : null}
                </div>
              );
            const avail = managers.filter((m) => m.id === id || !s.managerIds.includes(m.id));
            return (
              <div key={`m-${i}`} className="cx-slot">
                <select
                  className="lsel np-sel"
                  aria-label={i === 0 ? 'Project manager' : `Co-manager ${i}`}
                  value={id && managers.some((m) => m.id === id) ? id : ''}
                  disabled={p.managersLoading}
                  onChange={(e) => {
                    const next = [...s.managerIds];
                    next[i] = e.target.value;
                    p.setManagerIds(next);
                  }}
                >
                  <option value="">{p.managersLoading ? 'Loading managers…' : i === 0 ? 'Select project manager' : 'Select co-manager'}</option>
                  {avail.map((m) => (
                    <option key={m.id} value={m.id}>
                      {`${m.name} · ${m.email}`}
                    </option>
                  ))}
                </select>
                {s.managerIds.length > 1 ? (
                  <button type="button" className="ib sm" aria-label="Remove manager" title="Remove manager" onClick={() => p.setManagerIds(s.managerIds.filter((_, j) => j !== i))}>
                    <Icon name="x" />
                  </button>
                ) : null}
              </div>
            );
          })}
          {fieldError('managerId') ? <span className="np-err">{fieldError('managerId')}</span> : null}
          {canAddManager && !p.isEdit ? (
            <button
              type="button"
              className="btn sm cx-add"
              onClick={() => {
                const next = managers.find((m) => !s.managerIds.includes(m.id));
                if (next) p.setManagerIds([...s.managerIds, next.id]);
              }}
            >
              <Icon name="team" />
              Add another manager
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="mx-f np-f" role="group" aria-label="Project leads">
        <span className="mx-fl">
          {`Project lead${s.internIds.filter((id) => id.trim()).length > 1 ? 's' : ''}`}
          <span className="cx-req" aria-hidden="true"> *</span>
        </span>
        {leadSlots.map((id, i) => {
          const avail = owners.filter((o) => o.id === id || !s.internIds.includes(o.id));
          return (
            <div key={`l-${i}`} className="cx-slot">
              <select
                className="lsel np-sel"
                aria-label={i === 0 ? 'Primary project lead' : `Project lead ${i + 1}`}
                value={id && owners.some((o) => o.id === id) ? id : ''}
                disabled={p.internsLoading}
                onChange={(e) => {
                  const next = [...s.internIds];
                  next[i] = e.target.value;
                  p.setInternIds(next.length ? next : ['']);
                }}
              >
                <option value="">{p.internsLoading ? 'Loading team…' : i === 0 ? 'Select primary project lead' : `Select lead ${i + 1}`}</option>
                {avail.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {i === 0 && id === o.id ? ' (primary)' : ''}
                  </option>
                ))}
              </select>
              {s.internIds.length > 1 ? (
                <button
                  type="button"
                  className="ib sm"
                  aria-label="Remove project lead"
                  title="Remove project lead"
                  onClick={() => {
                    const next = s.internIds.filter((_, j) => j !== i);
                    p.setInternIds(next.length ? next : ['']);
                  }}
                >
                  <Icon name="x" />
                </button>
              ) : null}
            </div>
          );
        })}
        {fieldError('internId') ? <span className="np-err">{fieldError('internId')}</span> : <span className="mx-fh">The first lead is the primary; they run the steps.</span>}
        <button
          type="button"
          className="btn sm cx-add"
          disabled={!canAddLead || p.internsLoading}
          title={canAddLead ? 'Add another project lead' : 'No more project leads available — add people first'}
          onClick={() => {
            if (canAddLead && !s.internIds.some((x) => !x.trim())) p.setInternIds([...s.internIds, '']);
          }}
        >
          <Icon name="team" />
          Add another lead
        </button>
      </div>
    </div>
  );
}

export function ClientFields({ p, onChangeEmail }: { p: ProjectForm; onChangeEmail?: () => void }) {
  const { s, patch, fieldError } = p;
  if (p.isEdit) {
    return (
      <div className="np-g2">
        <PField label="Client contact name">
          <input className="mx-in" value={s.clientContact} maxLength={120} onChange={(e) => patch({ clientContact: e.target.value })} />
        </PField>
        <div className="mx-f np-f">
          <span className="mx-fl">Portal sign-in email</span>
          <div className="cx-slot">
            <input className="mx-in" value={p.existingClientEmail || '—'} disabled readOnly aria-label="Portal sign-in email" />
            {onChangeEmail ? (
              <Btn cls="sm" onClick={onChangeEmail}>
                {p.isFirmAdmin ? 'Change email' : 'Request change'}
              </Btn>
            ) : null}
          </div>
          <span className="mx-fh">{p.isFirmAdmin ? 'Changing it moves the portal sign-in.' : 'A manager asks an admin to change it.'}</span>
        </div>
      </div>
    );
  }
  const normalized = normalizeToE164(s.clientPhone);
  const phoneBad = Boolean(s.clientPhone.trim()) && !normalized;
  return (
    <>
      <div className="np-g2">
        <PField label="Client contact name (optional)">
          <input className="mx-in" value={s.clientContact} maxLength={120} placeholder="e.g. Priya Nair, Director" onChange={(e) => patch({ clientContact: e.target.value })} />
        </PField>
        <PField label="Client mobile (optional)" error={phoneBad ? 'Enter a mobile with country code, e.g. +91 98765 43210' : undefined}>
          <input className="mx-in" type="tel" inputMode="tel" maxLength={24} value={s.clientPhone} placeholder="+91 98765 43210" onChange={(e) => patch({ clientPhone: e.target.value })} />
        </PField>
      </div>
      <label className={'np-chk' + (normalized ? '' : ' cx-dim')}>
        <input type="checkbox" checked={s.clientWhatsappConsent} disabled={!normalized} onChange={(e) => patch({ clientWhatsappConsent: e.target.checked })} />
        <span>The client agrees to receive WhatsApp updates about this engagement on this number. They can reply STOP at any time to withdraw.</span>
      </label>
      <div className="np-g2">
        <PField label="Client sign-in email" req error={fieldError('clientEmail')} hint="Gets the portal invite">
          <input className="mx-in" type="email" autoComplete="email" maxLength={160} value={s.clientEmail} placeholder="founder@abc.in" onChange={(e) => patch({ clientEmail: e.target.value })} />
        </PField>
        <PField label="Initial portal password" req error={fieldError('clientPassword')} hint={p.pwStrength ? `Strength: ${p.pwStrength}` : undefined}>
          <span className="cx-pw">
            <input
              className="mx-in"
              type={s.showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={8}
              value={s.clientPassword}
              onChange={(e) => patch({ clientPassword: e.target.value })}
            />
            <button type="button" className="ib sm" aria-label={s.showPassword ? 'Hide password' : 'Show password'} title={s.showPassword ? 'Hide password' : 'Show password'} onClick={() => patch({ showPassword: !s.showPassword })}>
              <Icon name={s.showPassword ? 'lock' : 'eye'} />
            </button>
          </span>
        </PField>
      </div>
    </>
  );
}

export function QuestionnaireFields({ p }: { p: ProjectForm }) {
  return (
    <Island cls="cx-quiz">
      <CreateProjectQuestionnaire answers={p.s.questionnaire} onChange={(next: QuestionnaireAnswers) => p.patch({ questionnaire: next })} />
    </Island>
  );
}
