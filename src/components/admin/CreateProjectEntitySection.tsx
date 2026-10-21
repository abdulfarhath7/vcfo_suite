import { Building2, Layers, Globe2, Handshake, MapPin, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/admin/create-project-form-shared';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { CreateProjectStartingPhasePicker } from '@/components/admin/CreateProjectPhasePath';
import {
  COMPANY_TYPES,
  OWNERSHIP_TYPES,
  PARENT_INDIAN_RELATIONSHIPS,
  ENTITY_LEGAL_FORMS,
} from '@/components/admin/create-project-form-utils';
import { NocTemplateLine } from '@/components/admin/NocTemplatePreview';
import type {
  CreateProjectFormViewProps,
} from '@/components/admin/create-project-form-view-shared';
import type { CreateProjectViewDerived } from '@/components/admin/create-project-form-derive';

/** The Entity details section: ownership, company type, legal form, subsidiary and parent entity, starting phase. */
export function renderEntitySection(ctx: CreateProjectFormViewProps & CreateProjectViewDerived) {
  const {
    ownershipType,
    setOwnershipType,
    companyType,
    setCompanyType,
    parentIndianRelationship,
    setParentIndianRelationship,
    entityLegalForm,
    setEntityLegalForm,
    subsidiaryLegalName,
    setSubsidiaryLegalName,
    subsidiaryRegisteredAddress,
    setSubsidiaryRegisteredAddress,
    parentEntityName,
    setParentEntityName,
    parentEntityAddress,
    setParentEntityAddress,
    stage,
    setStage,
    fieldError,
    independent,
    needsSubsidiary,
    needsParent,
    needsParentRole,
    nocVariant,
  } = ctx;

  return (
    <div id="create-section-entity" className="space-y-5">
    <div>
      <span
        id="create-ownership-type-label"
        className="flex items-center gap-1.5 text-[12px] text-ink-muted"
      >
        <Network className="h-3.5 w-3.5" aria-hidden />
        Ownership <span className="font-normal text-danger">*</span>
      </span>
      <SegmentedPicker
        value={ownershipType}
        options={OWNERSHIP_TYPES.map((opt) => ({ value: opt.value, label: opt.label }))}
        onChange={setOwnershipType}
        labelledBy="create-ownership-type-label"
        className="mt-2 max-w-xs"
      />
      <p className="mt-1.5 text-[11.5px] text-ink-muted">
        {OWNERSHIP_TYPES.find((opt) => opt.value === ownershipType)?.hint}
        {independent ? ' — no parent or subsidiary details are asked.' : '.'}
      </p>
    </div>

    {independent ? null : (
    <div>
      <span
        id="create-company-type-label"
        className="flex items-center gap-1.5 text-[12px] text-ink-muted"
      >
        <Globe2 className="h-3.5 w-3.5" aria-hidden />
        Subsidiary type <span className="font-normal text-danger">*</span>
      </span>
      <SegmentedPicker
        value={companyType}
        options={COMPANY_TYPES.map((opt) => ({ value: opt.value, label: opt.label }))}
        onChange={setCompanyType}
        labelledBy="create-company-type-label"
        className="mt-2 max-w-xs"
      />
      <p className="mt-1.5 text-[11.5px] text-ink-muted">
        {COMPANY_TYPES.find((opt) => opt.value === companyType)?.hint}
      </p>
      <FieldError id="create-company-type-error" message={fieldError('companyType')} />
    </div>
    )}

    {needsParentRole ? (
    <div>
      <span
        id="create-parent-role-label"
        className="flex items-center gap-1.5 text-[12px] text-ink-muted"
      >
        <Handshake className="h-3.5 w-3.5" aria-hidden />
        Parent&apos;s role <span className="font-normal text-danger">*</span>
      </span>
      <SegmentedPicker
        value={parentIndianRelationship}
        options={PARENT_INDIAN_RELATIONSHIPS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
        onChange={setParentIndianRelationship}
        labelledBy="create-parent-role-label"
        className="mt-2 max-w-xs"
      />
      {parentIndianRelationship ? (
        <p className="mt-1.5 text-[11.5px] text-ink-muted">
          {
            PARENT_INDIAN_RELATIONSHIPS.find(
              (opt) => opt.value === parentIndianRelationship,
            )?.hint
          }
        </p>
      ) : null}
      <FieldError
        id="create-parent-role-error"
        message={fieldError('parentIndianRelationship')}
      />
    </div>
    ) : null}

    {nocVariant ? <NocTemplateLine variant={nocVariant} /> : null}

    <CreateProjectStartingPhasePicker stage={stage} onChange={setStage} />

    {needsParent ? (
      <div className="space-y-5 rounded-xl border border-brand/20 bg-brand-soft/50 p-4 sm:p-5">
        <div>
          <p className="text-[13px] font-medium text-ink">Parent entity details</p>
          <p className="mt-1 text-[11.5px] text-ink-muted">
            The company that owns this subsidiary. SPICe+ Part A is prefilled from
            these details.
          </p>
        </div>
        <div>
          <Label
            htmlFor="create-parent-entity-name"
            className="flex items-center gap-1.5 text-[12px] text-ink-muted"
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            Parent entity legal name <span className="font-normal text-danger">*</span>
          </Label>
          <Input
            id="create-parent-entity-name"
            value={parentEntityName}
            onChange={(e) => setParentEntityName(e.target.value)}
            placeholder="e.g. ABC Holdings Inc."
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
            className="flex items-center gap-1.5 text-[12px] text-ink-muted"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Parent entity registered address{' '}
            <span className="font-normal text-danger">*</span>
          </Label>
          <Textarea
            id="create-parent-entity-address"
            value={parentEntityAddress}
            onChange={(e) => setParentEntityAddress(e.target.value)}
            placeholder={'e.g. 100 Main Street\nSalt Lake City, Utah 84101\nUnited States of America'}
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
    ) : null}

    {needsSubsidiary ? (
      <div className="space-y-5 rounded-xl border border-brand/20 bg-brand-soft/50 p-4 sm:p-5">
        <p className="text-[13px] font-medium text-ink">
          Subsidiary company details
        </p>
        <div>
          <Label
            htmlFor="create-subsidiary-legal-name"
            className="flex items-center gap-1.5 text-[12px] text-ink-muted"
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
            className="flex items-center gap-1.5 text-[12px] text-ink-muted"
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
        id="create-entity-legal-form-label"
        className="flex items-center gap-1.5 text-[12px] text-ink-muted"
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
  );
}
