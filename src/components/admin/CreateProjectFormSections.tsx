'use client';

import { useState } from 'react';
import {
  Building2,
  User,
  Layers,
  Globe2,
  MapPin,
  KeyRound,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FieldError } from '@/components/admin/create-project-form-shared';
import {
  CreateProjectFormFlow,
  CreateProjectStartingPhasePicker,
  type FormFlowSection,
} from '@/components/admin/CreateProjectPhasePath';
import { CreateProjectClientFields } from '@/components/admin/CreateProjectFormClientSection';
import {
  COMPANY_TYPES,
  ENTITY_LEGAL_FORMS,
  STAGE_LABEL,
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
const choiceBtnClass =
  'flex min-h-[4.25rem] flex-col justify-center rounded-xl border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
};

function sectionMeta(complete: boolean, summary: string) {
  return (
    <span
      className={cn(
        'mr-2 hidden text-[11px] font-normal sm:inline',
        complete ? 'text-emerald-700' : 'text-muted-foreground',
      )}
    >
      {summary}
    </span>
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
    owners,
    internsLoading,
    fieldError,
    submit,
    saveDraft,
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
  const clientDone = Boolean(props.clientEmail.trim() && props.clientPassword);
  const selectedOwners = owners.filter((o) => internIds.includes(o.id));
  const selectedManagers = managers.filter((m) => managerIds.includes(m.id));
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

  const [openSections, setOpenSections] = useState<FormFlowSection[]>(['entity']);

  const sectionComplete: Record<FormFlowSection, boolean> = {
    entity: entityDone,
    team: teamDone,
    client: clientDone,
  };

  const selectSection = (section: FormFlowSection) => {
    setOpenSections((prev) => (prev.includes(section) ? prev : [...prev, section]));
    requestAnimationFrame(() => {
      document
        .getElementById(`create-section-${section}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const flowProps = {
    openSections,
    sectionComplete,
    onSelect: selectSection,
  };

  return (
    <div className="relative w-full lg:pr-[14rem] xl:pr-[14.75rem]">
      {/* Mobile / tablet: compact top stepper */}
      <div className="mb-8 lg:hidden">
        <CreateProjectFormFlow {...flowProps} variant="compact" />
      </div>

      <fieldset disabled={submitting} className="m-0 min-w-0 space-y-8 border-0 p-0">
        <div className="rounded-2xl border border-border/70 bg-panel/70 p-5 sm:p-8 lg:p-9">
          <div>
            <Label htmlFor="create-company-name" className="text-[12px] text-muted-foreground">
              Project name <span className="font-normal text-danger">*</span>
            </Label>
            <Input
              id="create-company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. ABC India GCC"
              className={cn(
                'mt-2 h-11 px-3.5 text-[15px]',
                fieldError('companyName') && 'border-danger focus-visible:ring-danger/30',
              )}
              aria-invalid={!!fieldError('companyName')}
              aria-describedby={
                fieldError('companyName') ? 'create-company-name-error' : 'create-company-name-hint'
              }
              autoFocus
              maxLength={120}
            />
            <FieldError id="create-company-name-error" message={fieldError('companyName')} />
            {!fieldError('companyName') ? (
              <p id="create-company-name-hint" className="mt-2 text-[12px] text-muted-foreground">
                Short name for this engagement in VCFO Suite.
              </p>
            ) : null}
          </div>

          {/* Progressive disclosure */}
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={(v) => setOpenSections(v as FormFlowSection[])}
            className="mt-6 border-t border-border/60 pt-2"
          >
            <AccordionItem value="entity" id="create-section-entity" className="border-border/50">
            <AccordionTrigger className="py-4 text-[14px] font-medium hover:no-underline">
              <span className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Entity details
                </span>
                {sectionMeta(
                  entityDone,
                  entityDone
                    ? `${STAGE_LABEL[stage]} · ${companyType === 'foreign' ? 'Foreign' : 'Domestic'} · ${ENTITY_LEGAL_FORMS.find((f) => f.value === entityLegalForm)?.label ?? ''}`
                    : needsSubsidiary
                      ? 'Start phase, subsidiary, parent, origin, legal form'
                      : 'Parent, origin, start phase, legal form',
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pb-6">
              <CreateProjectStartingPhasePicker stage={stage} onChange={setStage} />

              <div className="space-y-5 rounded-xl border border-border/80 bg-muted/25 p-4 sm:p-5">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Parent company details</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    Full legal name and registered address of the parent / group entity.
                  </p>
                </div>
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
                <div className="space-y-5 rounded-xl border border-orange-200/70 bg-orange-50/40 p-4 sm:p-5">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      Subsidiary company details
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                      Required when starting at {STAGE_LABEL[stage]} — the India entity already
                      exists.
                    </p>
                  </div>
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
                <fieldset
                  aria-labelledby="create-company-type-label"
                  className="mt-2 m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2"
                >
                  {COMPANY_TYPES.map((opt) => {
                    const active = companyType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCompanyType(opt.value)}
                        aria-pressed={active}
                        className={cn(
                          choiceBtnClass,
                          active
                            ? 'border-orange-400/70 bg-orange-50/80 ring-1 ring-orange-200/50'
                            : 'border-border/80 bg-background hover:bg-muted/35',
                          fieldError('companyType') && !active && 'border-danger/40',
                        )}
                      >
                        <div
                          className={cn(
                            'text-[14px] font-medium',
                            active ? 'text-orange-900' : 'text-foreground',
                          )}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </fieldset>
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
                <fieldset
                  aria-labelledby="create-entity-legal-form-label"
                  className="mt-2 m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2"
                >
                  {ENTITY_LEGAL_FORMS.map((opt) => {
                    const active = entityLegalForm === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEntityLegalForm(opt.value)}
                        aria-pressed={active}
                        className={cn(
                          choiceBtnClass,
                          active
                            ? 'border-orange-400/70 bg-orange-50/80 ring-1 ring-orange-200/50'
                            : 'border-border/80 bg-background hover:bg-muted/35',
                        )}
                      >
                        <div
                          className={cn(
                            'text-[14px] font-medium',
                            active ? 'text-orange-900' : 'text-foreground',
                          )}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </fieldset>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Drives which recurring compliances appear on the calendar for this project.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="team" id="create-section-team" className="border-border/50">
            <AccordionTrigger className="py-5 text-[14px] font-medium hover:no-underline">
              <span className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Team
                </span>
                {sectionMeta(
                  teamDone,
                  teamDone
                    ? [
                        ...(lockFirstManager
                          ? [
                              lockedManager?.name,
                              ...selectedManagers
                                .filter((m) => m.id !== selfManagerId)
                                .map((m) => m.name),
                            ]
                          : selectedManagers.map((m) => m.name)),
                        ...selectedOwners.map((o) => o.name),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Managers left · leads right',
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-7 pt-1">
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
                    <p className="text-[12px] leading-snug text-muted-foreground">
                      Primary manager first. Add co-managers if needed.
                    </p>
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
                                value={id || undefined}
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
                    {canAddManager ? (
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
                  <p className="text-[12px] leading-snug text-muted-foreground">
                    First lead is primary. Add more for shared delivery.
                  </p>
                  <div className="space-y-2.5">
                    {(internIds.length ? internIds : ['']).map((id, index) => (
                      <div key={`lead-${index}`} className="flex items-start gap-2">
                        <Select
                          value={id || undefined}
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
                  {!canAddLead && !internsLoading && owners.length > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      All available project leads are already assigned. Add more in People to expand
                      the team.
                    </p>
                  ) : null}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="client" id="create-section-client" className="border-b-0 border-border/50">
            <AccordionTrigger className="py-4 text-[14px] font-medium hover:no-underline">
              <span className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                <span className="inline-flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Client portal access
                </span>
                {sectionMeta(
                  clientDone,
                  clientDone
                    ? props.clientEmail.trim() || 'Ready'
                    : 'Email + initial password',
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-7 pt-1">
              <CreateProjectClientFields {...props} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-snug text-muted-foreground">
            Seeds phase tasks · provisions client login · welcome email when Resend is set
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-4"
                onClick={onCancel}
                disabled={submitting}
              >
                Discard
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              onClick={saveDraft}
              disabled={submitting}
            >
              Save as draft
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="gold-sheen h-10 min-w-[10.5rem] px-5"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                'Create project'
              )}
            </Button>
          </div>
        </div>
      </fieldset>

      {/* Progress rail — card chrome so it stays readable beside the form */}
      <div className="pointer-events-none fixed bottom-5 right-3 top-[4.75rem] z-20 hidden w-[13.25rem] lg:block xl:right-5 xl:w-[14rem]">
        <div className="pointer-events-auto h-full">
          <CreateProjectFormFlow {...flowProps} variant="rail" className="h-full" />
        </div>
      </div>
    </div>
  );
}
