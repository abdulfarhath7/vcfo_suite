'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  Pencil,
  User,
  Layers,
  Globe2,
  MapPin,
  KeyRound,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { m as motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/admin/create-project-form-shared';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { CreateProjectQuestionnaire } from '@/components/admin/CreateProjectQuestionnaire';
import {
  questionnaireProgress,
  type QuestionnaireAnswers,
} from '@/data/compliance-questionnaire';
import {
  CreateProjectFormFlow,
  CreateProjectStartingPhasePicker,
  type FormFlowSection,
} from '@/components/admin/CreateProjectPhasePath';
import { CreateProjectClientFields } from '@/components/admin/CreateProjectFormClientSection';
import {
  COMPANY_TYPES,
  ENTITY_LEGAL_FORMS,
  stageRequiresSubsidiary,
  type Stage,
} from '@/components/admin/create-project-form-utils';
import type { CompanyType, EntityLegalForm } from '@/data/engagements';

type CreateProjectOwnerOption = {
  id: string;
  name: string;
  initials: string;
  email?: string;
};

type CreateProjectFieldErrorKey =
  | 'companyName'
  | 'companyType'
  | 'parentEntityName'
  | 'parentEntityAddress'
  | 'subsidiaryLegalName'
  | 'subsidiaryRegisteredAddress'
  | 'clientEmail'
  | 'clientPassword'
  | 'managerId'
  | 'internId';

const fieldLabelClass =
  'flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground';
const fieldControlClass = 'mt-2 h-11 px-3.5 text-[14px]';

export type CreateProjectFormViewProps = {
  onCancel?: () => void;
  submitting: boolean;
  companyName: string;
  setCompanyName: (value: string) => void;
  companyType: CompanyType;
  setCompanyType: (value: CompanyType) => void;
  entityLegalForm: EntityLegalForm;
  setEntityLegalForm: (value: EntityLegalForm) => void;
  parentEntityName: string;
  setParentEntityName: (value: string) => void;
  parentEntityAddress: string;
  setParentEntityAddress: (value: string) => void;
  subsidiaryLegalName: string;
  setSubsidiaryLegalName: (value: string) => void;
  subsidiaryRegisteredAddress: string;
  setSubsidiaryRegisteredAddress: (value: string) => void;
  clientContact: string;
  setClientContact: (value: string) => void;
  clientEmail: string;
  setClientEmail: (value: string) => void;
  clientPassword: string;
  setClientPassword: (value: string) => void;
  internIds: string[];
  setInternIds: (value: string[]) => void;
  managerIds: string[];
  setManagerIds: (value: string[]) => void;
  /** When true, first manager slot is fixed to the signed-in manager. */
  lockFirstManager: boolean;
  selfManagerId: string;
  showManagerPicker: boolean;
  managers: Array<{ id: string; name: string; email: string }>;
  managersLoading: boolean;
  stage: Stage;
  setStage: (value: Stage) => void;
  questionnaire: QuestionnaireAnswers;
  setQuestionnaire: (value: QuestionnaireAnswers) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  owners: CreateProjectOwnerOption[];
  internsLoading: boolean;
  fieldError: (key: CreateProjectFieldErrorKey) => string;
  pwStrength: 'weak' | 'fair' | 'strong' | null;
  submit: () => void | Promise<void>;
  saveDraft: () => void;
  companyTypeValid: boolean;
  canSubmit: boolean;
  /** Editing an existing project — same form, PATCH semantics. */
  editMode?: boolean;
  /** Current portal sign-in, shown read-only while editing. */
  existingClientEmail?: string;
};

const SECTION_TABS: Array<{ id: FormFlowSection; label: string; icon: typeof Building2 }> = [
  { id: 'entity', label: 'Entity details', icon: Building2 },
  { id: 'team', label: 'Team', icon: User },
  { id: 'client', label: 'Client portal', icon: KeyRound },
  { id: 'questionnaire', label: 'Questionnaire', icon: ClipboardList },
];

/**
 * In-card tab bar: underline indicator slides between tabs (shared layout
 * animation), completed steps carry a filled green check. The bar's bottom
 * border doubles as the card header rule.
 */
function SectionTabs({
  active,
  complete,
  onSelect,
}: {
  active: FormFlowSection;
  complete: Record<FormFlowSection, boolean>;
  onSelect: (section: FormFlowSection) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Project details"
      className="flex gap-0.5 overflow-x-auto border-b border-border/70 px-2 sm:px-4"
    >
      {SECTION_TABS.map((tab) => {
        const isActive = tab.id === active;
        const done = complete[tab.id];
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-3 text-[13px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {done ? (
              <span
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success text-white"
                aria-hidden
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
              </span>
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            {tab.label}
            {isActive ? (
              <motion.span
                layoutId="create-section-tab-underline"
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function CreateProjectFormView(props: CreateProjectFormViewProps) {
  const {
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
    subsidiaryLegalName,
    setSubsidiaryLegalName,
    subsidiaryRegisteredAddress,
    setSubsidiaryRegisteredAddress,
    internIds,
    setInternIds,
    managerIds,
    setManagerIds,
    lockFirstManager,
    selfManagerId,
    showManagerPicker,
    managers,
    managersLoading,
    stage,
    setStage,
    questionnaire,
    setQuestionnaire,
    owners,
    internsLoading,
    fieldError,
    submit,
    saveDraft,
    editMode,
    existingClientEmail,
  } = props;

  const needsSubsidiary = stageRequiresSubsidiary(stage);
  const entityDone = Boolean(
    parentEntityName.trim() &&
      parentEntityAddress.trim() &&
      companyType &&
      (!needsSubsidiary ||
        (subsidiaryLegalName.trim() && subsidiaryRegisteredAddress.trim())),
  );
  const teamDone = Boolean(
    internIds.some((id) => id.trim()) &&
      (!showManagerPicker || managerIds.some((id) => id.trim())),
  );
  const clientDone = editMode ? true : Boolean(props.clientEmail.trim() && props.clientPassword);
  const lockedManager =
    lockFirstManager && selfManagerId
      ? managers.find((m) => m.id === selfManagerId) ?? {
          id: selfManagerId,
          name: 'You',
          email: '',
        }
      : null;

  const availableManagersForSlot = (slotIndex: number) =>
    managers.filter(
      (m) => m.id === managerIds[slotIndex] || !managerIds.includes(m.id),
    );
  const availableLeadsForSlot = (slotIndex: number) =>
    owners.filter((o) => o.id === internIds[slotIndex] || !internIds.includes(o.id));

  const canAddManager =
    showManagerPicker &&
    !managerIds.some((id) => !id.trim()) &&
    managers.some((m) => !managerIds.includes(m.id));
  const canAddLead =
    !internIds.some((id) => !id.trim()) &&
    owners.some((o) => !internIds.filter((id) => id.trim()).includes(o.id));

  const updateManagerAt = (index: number, nextId: string) => {
    const next = [...managerIds];
    next[index] = nextId;
    setManagerIds(next);
  };
  const removeManagerAt = (index: number) => {
    if (lockFirstManager && index === 0) return;
    setManagerIds(managerIds.filter((_, i) => i !== index));
  };
  const addManager = () => {
    const next = managers.find((m) => !managerIds.includes(m.id));
    if (!next) return;
    setManagerIds([...managerIds, next.id]);
  };

  const updateLeadAt = (index: number, nextId: string) => {
    const next = [...internIds];
    next[index] = nextId;
    setInternIds(next.length ? next : ['']);
  };
  const removeLeadAt = (index: number) => {
    const next = internIds.filter((_, i) => i !== index);
    setInternIds(next.length ? next : ['']);
  };
  const addLead = () => {
    if (!canAddLead) return;
    // Open an empty picker slot so the user chooses the next lead.
    if (internIds.some((id) => !id.trim())) return;
    setInternIds([...internIds, '']);
  };

  const [activeSection, setActiveSection] = useState<FormFlowSection>('entity');
  /** Filled + blurred = plain title; click brings the field back. */
  const [nameEditing, setNameEditing] = useState(false);
  const nameFieldVisible =
    nameEditing || !companyName.trim() || Boolean(fieldError('companyName'));

  const internErr = fieldError('internId');
  const managerErr = fieldError('managerId');
  const entityErr =
    fieldError('companyName') ||
    fieldError('companyType') ||
    fieldError('parentEntityName') ||
    fieldError('parentEntityAddress') ||
    fieldError('subsidiaryLegalName') ||
    fieldError('subsidiaryRegisteredAddress');
  const clientErr = fieldError('clientEmail') || fieldError('clientPassword');

  // Jump to the first section with a validation error.
  useEffect(() => {
    if (entityErr) setActiveSection('entity');
    else if (internErr || managerErr) setActiveSection('team');
    else if (clientErr) setActiveSection('client');
  }, [entityErr, internErr, managerErr, clientErr]);

  const questionnaireDone = questionnaireProgress(questionnaire).complete;

  const sectionComplete: Record<FormFlowSection, boolean> = {
    entity: entityDone,
    team: teamDone,
    client: clientDone,
    questionnaire: questionnaireDone,
  };

  const flowProps = {
    openSections: [activeSection] as FormFlowSection[],
    sectionComplete,
    onSelect: setActiveSection,
  };

  const SECTION_ORDER: FormFlowSection[] = ['entity', 'team', 'client', 'questionnaire'];
  /** Questionnaire is optional — the submit gate is the three required tabs. */
  const requiredSectionsDone = entityDone && teamDone && clientDone;
  /** Next tab in order; from the last tab, jump back to the first unfinished one. */
  const goNext = () => {
    const idx = SECTION_ORDER.indexOf(activeSection);
    const next =
      idx < SECTION_ORDER.length - 1
        ? SECTION_ORDER[idx + 1]
        : SECTION_ORDER.find((id) => !sectionComplete[id]);
    if (next) setActiveSection(next);
  };

  return (
    <div className="relative w-full items-start gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_13.5rem] xl:grid-cols-[minmax(0,1fr)_14rem]">
      {/* Mobile / tablet: compact stepper above the form */}
      <div className="mb-6 lg:hidden">
        <CreateProjectFormFlow {...flowProps} variant="compact" />
      </div>

      <fieldset disabled={submitting} className="m-0 min-w-0 space-y-4 border-0 p-0">
        {/* One card: name in the header, underline tabs inside, content below */}
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-panel">
          <div className="px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
            <Label htmlFor="create-company-name" className="text-[12px] text-muted-foreground">
              Project name <span className="font-normal text-danger">*</span>
            </Label>
            {nameFieldVisible ? (
              <Input
                id="create-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onBlur={() => {
                  if (companyName.trim()) setNameEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && companyName.trim()) {
                    e.preventDefault();
                    setNameEditing(false);
                  }
                }}
                placeholder="e.g. ABC India GCC"
                className={cn(
                  'mt-2 h-11 max-w-xl px-3.5 text-[15px] font-medium',
                  fieldError('companyName') && 'border-danger focus-visible:ring-danger/30',
                )}
                aria-invalid={!!fieldError('companyName')}
                aria-describedby={
                  fieldError('companyName') ? 'create-company-name-error' : undefined
                }
                autoFocus
                maxLength={120}
              />
            ) : (
              <button
                type="button"
                onClick={() => setNameEditing(true)}
                title="Edit project name"
                className={cn(
                  'group mt-1 flex w-full max-w-xl items-center gap-2 rounded-md px-0.5 py-1 text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <span className="min-w-0 truncate text-[1.3rem] font-semibold tracking-tight text-ink">
                  {companyName}
                </span>
                <Pencil
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden
                />
              </button>
            )}
            <FieldError id="create-company-name-error" message={fieldError('companyName')} />
          </div>

          <SectionTabs
            active={activeSection}
            complete={sectionComplete}
            onSelect={setActiveSection}
          />

          <div className="p-5 sm:p-7 lg:p-8">
            {activeSection === 'entity' ? (
              <div id="create-section-entity" className="space-y-5">
              <CreateProjectStartingPhasePicker stage={stage} onChange={setStage} />

              <div className="space-y-5 rounded-xl border border-border/80 bg-muted/25 p-4 sm:p-5">
                <p className="text-[13px] font-medium text-foreground">Parent company details</p>
                <div>
                  <Label
                    htmlFor="create-parent-entity-name"
                    className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                  >
                    <Building2 className="h-3.5 w-3.5" aria-hidden />
                    Parent entity legal name <span className="font-normal text-danger">*</span>
                  </Label>
                  <Input
                    id="create-parent-entity-name"
                    value={parentEntityName}
                    onChange={(e) => setParentEntityName(e.target.value)}
                    placeholder="e.g. ABC Holdings Limited"
                    className={cn(
                      'mt-2 h-11 text-[14px]',
                      fieldError('parentEntityName') && 'border-danger focus-visible:ring-danger/30',
                    )}
                    aria-invalid={!!fieldError('parentEntityName')}
                    maxLength={240}
                  />
                  <FieldError
                    id="create-parent-entity-name-error"
                    message={fieldError('parentEntityName')}
                  />
                </div>

                <div>
                  <Label
                    htmlFor="create-parent-entity-address"
                    className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Parent entity registered address{' '}
                    <span className="font-normal text-danger">*</span>
                  </Label>
                  <Textarea
                    id="create-parent-entity-address"
                    value={parentEntityAddress}
                    onChange={(e) => setParentEntityAddress(e.target.value)}
                    placeholder={
                      'e.g. 100 Market Street, Suite 400\nSan Francisco, CA 94105\nUnited States of America'
                    }
                    className={cn(
                      'mt-2 min-h-[100px] resize-y text-[14px]',
                      fieldError('parentEntityAddress') &&
                        'border-danger focus-visible:ring-danger/30',
                    )}
                    aria-invalid={!!fieldError('parentEntityAddress')}
                    maxLength={2000}
                    rows={3}
                  />
                  <FieldError
                    id="create-parent-entity-address-error"
                    message={fieldError('parentEntityAddress')}
                  />
                </div>
              </div>

              {needsSubsidiary ? (
                <div className="space-y-5 rounded-xl border border-primary/20 bg-primary-light/50 p-4 sm:p-5">
                  <p className="text-[13px] font-medium text-foreground">
                    Subsidiary company details
                  </p>
                  <div>
                    <Label
                      htmlFor="create-subsidiary-legal-name"
                      className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                    >
                      <Building2 className="h-3.5 w-3.5" aria-hidden />
                      Subsidiary company legal name{' '}
                      <span className="font-normal text-danger">*</span>
                    </Label>
                    <Input
                      id="create-subsidiary-legal-name"
                      value={subsidiaryLegalName}
                      onChange={(e) => setSubsidiaryLegalName(e.target.value)}
                      placeholder="e.g. ABC India Private Limited"
                      className={cn(
                        'mt-2 h-11 text-[14px]',
                        fieldError('subsidiaryLegalName') &&
                          'border-danger focus-visible:ring-danger/30',
                      )}
                      aria-invalid={!!fieldError('subsidiaryLegalName')}
                      maxLength={240}
                    />
                    <FieldError
                      id="create-subsidiary-legal-name-error"
                      message={fieldError('subsidiaryLegalName')}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="create-subsidiary-registered-address"
                      className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      Subsidiary company registered address{' '}
                      <span className="font-normal text-danger">*</span>
                    </Label>
                    <Textarea
                      id="create-subsidiary-registered-address"
                      value={subsidiaryRegisteredAddress}
                      onChange={(e) => setSubsidiaryRegisteredAddress(e.target.value)}
                      placeholder={
                        'e.g. 12th Floor, Prestige Tech Park\nOuter Ring Road, Bangalore 560103\nKarnataka, India'
                      }
                      className={cn(
                        'mt-2 min-h-[100px] resize-y text-[14px]',
                        fieldError('subsidiaryRegisteredAddress') &&
                          'border-danger focus-visible:ring-danger/30',
                      )}
                      aria-invalid={!!fieldError('subsidiaryRegisteredAddress')}
                      maxLength={2000}
                      rows={3}
                    />
                    <FieldError
                      id="create-subsidiary-registered-address-error"
                      message={fieldError('subsidiaryRegisteredAddress')}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <span
                  id="create-company-type-label"
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                >
                  <Globe2 className="h-3.5 w-3.5" aria-hidden />
                  Entity origin <span className="font-normal text-danger">*</span>
                </span>
                <SegmentedPicker
                  value={companyType}
                  options={COMPANY_TYPES.map((opt) => ({ value: opt.value, label: opt.label }))}
                  onChange={setCompanyType}
                  labelledBy="create-company-type-label"
                  className="mt-2 max-w-xs"
                />
                <FieldError id="create-company-type-error" message={fieldError('companyType')} />
              </div>

              <div>
                <span
                  id="create-entity-legal-form-label"
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                >
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                  Entity legal form <span className="font-normal text-danger">*</span>
                </span>
                <SegmentedPicker
                  value={entityLegalForm}
                  options={ENTITY_LEGAL_FORMS.map((opt) => ({ value: opt.value, label: opt.label }))}
                  onChange={setEntityLegalForm}
                  labelledBy="create-entity-legal-form-label"
                  className="mt-2 max-w-2xl"
                  columns={4}
                />
              </div>
              </div>
            ) : null}

            {activeSection === 'team' ? (
              <div id="create-section-team">
              <div
                className={cn(
                  'grid grid-cols-1 gap-6',
                  showManagerPicker ? 'lg:grid-cols-2 lg:gap-8' : 'sm:max-w-xl',
                )}
              >
                {/* Left: project managers */}
                {showManagerPicker ? (
                  <div className="space-y-3">
                    <Label className={fieldLabelClass}>
                      <User className="h-3.5 w-3.5" aria-hidden />
                      Project manager{managerIds.length > 1 ? 's' : ''}{' '}
                      <span className="font-normal text-danger">*</span>
                    </Label>
                    <div className="space-y-2.5">
                      {(managerIds.length ? managerIds : ['']).map((id, index) => {
                        const locked = lockFirstManager && index === 0;
                        return (
                          <div key={`mgr-${index}`} className="flex items-start gap-2">
                            {locked ? (
                              <div
                                className={cn(
                                  fieldControlClass,
                                  'flex w-full items-center rounded-md border border-border/80 bg-muted/30 px-3.5',
                                )}
                              >
                                <span className="flex flex-col items-start gap-0.5">
                                  <span className="text-[13px] font-medium text-foreground">
                                    {lockedManager?.name ?? 'You'}
                                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                                      (you)
                                    </span>
                                  </span>
                                  {lockedManager?.email ? (
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                      {lockedManager.email}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            ) : (
                              <Select
                                value={
                                  id && managers.some((m) => m.id === id) ? id : undefined
                                }
                                onValueChange={(v) => updateManagerAt(index, v)}
                                disabled={managersLoading}
                              >
                                <SelectTrigger
                                  id={index === 0 ? 'create-manager' : `create-manager-${index}`}
                                  className={cn(fieldControlClass, 'w-full')}
                                >
                                  <SelectValue
                                    placeholder={
                                      managersLoading
                                        ? 'Loading managers…'
                                        : index === 0
                                          ? 'Select project manager'
                                          : 'Select co-manager'
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableManagersForSlot(index).map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="py-2.5">
                                      <span className="flex flex-col items-start gap-0.5">
                                        <span className="text-[13px] font-medium">{m.name}</span>
                                        <span className="font-mono text-[11px] text-muted-foreground">
                                          {m.email}
                                        </span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {!locked && managerIds.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="mt-0.5 h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => removeManagerAt(index)}
                                aria-label="Remove manager"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <FieldError id="create-manager-error" message={fieldError('managerId')} />
                    {canAddManager && !editMode ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5"
                        onClick={addManager}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add another manager
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {/* Right: project leads */}
                <div className="space-y-3">
                  <Label className={fieldLabelClass}>
                    <User className="h-3.5 w-3.5" aria-hidden />
                    Project lead{internIds.filter((id) => id.trim()).length > 1 ? 's' : ''}{' '}
                    <span className="font-normal text-danger">*</span>
                  </Label>
                  <div className="space-y-2.5">
                    {(internIds.length ? internIds : ['']).map((id, index) => (
                      <div key={`lead-${index}`} className="flex items-start gap-2">
                        <Select
                          value={id && owners.some((o) => o.id === id) ? id : undefined}
                          onValueChange={(v) => updateLeadAt(index, v)}
                          disabled={internsLoading}
                        >
                          <SelectTrigger
                            id={index === 0 ? 'create-intern' : `create-intern-${index}`}
                            className={cn(fieldControlClass, 'w-full')}
                          >
                            <SelectValue
                              placeholder={
                                internsLoading
                                  ? 'Loading team…'
                                  : index === 0
                                    ? 'Select primary project lead'
                                    : `Select lead ${index + 1}`
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLeadsForSlot(index).map((t) => {
                              const email =
                                'email' in t && typeof t.email === 'string' ? t.email : undefined;
                              return (
                                <SelectItem key={t.id} value={t.id} className="py-2.5">
                                  <span className="flex flex-col items-start gap-0.5">
                                    <span className="text-[13px] font-medium">
                                      {t.name}
                                      {index === 0 && id === t.id ? (
                                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                                          primary
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                      {email ?? t.initials}
                                    </span>
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {internIds.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-0.5 h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => removeLeadAt(index)}
                            aria-label="Remove project lead"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <FieldError id="create-intern-error" message={fieldError('internId')} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={addLead}
                    disabled={!canAddLead || internsLoading}
                    title={
                      canAddLead
                        ? 'Add another project lead'
                        : 'No more project leads available — add people first'
                    }
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add another lead
                  </Button>
                </div>
              </div>
              </div>
            ) : null}

            {activeSection === 'client' ? (
              <div id="create-section-client">
                {editMode ? (
                  <div className="grid max-w-xl grid-cols-1 gap-5">
                    <div>
                      <Label
                        htmlFor="edit-client-contact"
                        className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground"
                      >
                        <User className="h-3.5 w-3.5" aria-hidden />
                        Client contact name
                      </Label>
                      <Input
                        id="edit-client-contact"
                        value={props.clientContact}
                        onChange={(e) => props.setClientContact(e.target.value)}
                        className="mt-2 h-11 px-3.5 text-[14px]"
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="edit-client-email"
                        className="text-[12.5px] font-medium text-muted-foreground"
                      >
                        Portal sign-in email
                      </Label>
                      <Input
                        id="edit-client-email"
                        value={existingClientEmail || '—'}
                        disabled
                        readOnly
                        className="mt-2 h-11 px-3.5 text-[14px]"
                      />
                    </div>
                  </div>
                ) : (
                  <CreateProjectClientFields {...props} />
                )}
              </div>
            ) : null}

            {activeSection === 'questionnaire' ? (
              <div id="create-section-questionnaire">
                <CreateProjectQuestionnaire answers={questionnaire} onChange={setQuestionnaire} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-4"
                onClick={onCancel}
                disabled={submitting}
              >
                {editMode ? 'Cancel' : 'Discard'}
              </Button>
            ) : null}
            {editMode ? null : (
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4"
                onClick={saveDraft}
                disabled={submitting}
              >
                Save as draft
              </Button>
            )}
            {requiredSectionsDone ? (
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="gold-sheen h-10 min-w-[10.5rem] px-5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                    {editMode ? 'Saving…' : 'Creating…'}
                  </>
                ) : editMode ? (
                  'Save changes'
                ) : (
                  'Create project'
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="h-10 min-w-[8.5rem] gap-1.5 px-5"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </fieldset>

      {/* Progress flowchart — in flow, sticky beside the card (never overlaps) */}
      <div className="hidden lg:sticky lg:top-[calc(var(--shell-sticky-top)+0.75rem)] lg:block">
        <CreateProjectFormFlow {...flowProps} variant="rail" />
      </div>
    </div>
  );
}
