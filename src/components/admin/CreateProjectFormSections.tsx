"use client";

import {
  Building2, User, Activity, Layers, Mail, Lock, Globe2, MapPin,
  CheckCircle2, Circle, Clock, Loader2, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GoldDivider, Eyebrow } from "@/components/noir";
import { CreateFormSection, FieldError } from "@/components/admin/create-project-form-shared";
import { CreateProjectFormClientSection } from "@/components/admin/CreateProjectFormClientSection";
import {
  PHASES, PHASE_MILESTONES, PHASE_ORDER, COMPANY_TYPES, ENTITY_LEGAL_FORMS, HEALTH_OPTIONS,
  type Stage,
} from "@/components/admin/create-project-form-utils";
import type { CompanyType, EntityLegalForm } from "@/data/engagements";

type ProjectHealth = "on-track" | "at-risk" | "overdue";

/** Delivery-owner option rendered in the intern/lead select. Sourced from
 * `InternOption[]` or the seed `teamMembers`, neither of which carries an
 * email; the field is read defensively via `"email" in t`, so it is optional. */
type CreateProjectOwnerOption = {
  id: string;
  name: string;
  initials: string;
  email?: string;
};

/** Keys accepted by the `fieldError` resolver (mirrors the parent's
 * `keyof typeof fieldErrors`). */
type CreateProjectFieldErrorKey =
  | "companyName"
  | "companyType"
  | "parentEntityName"
  | "parentEntityAddress"
  | "clientEmail"
  | "clientPassword"
  | "managerId";

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
  clientContact: string;
  setClientContact: (value: string) => void;
  clientEmail: string;
  setClientEmail: (value: string) => void;
  clientPassword: string;
  setClientPassword: (value: string) => void;
  internId: string;
  setInternId: (value: string) => void;
  managerId: string;
  setManagerId: (value: string) => void;
  showManagerPicker: boolean;
  managers: Array<{ id: string; name: string; email: string }>;
  managersLoading: boolean;
  stage: Stage;
  setStage: (value: Stage) => void;
  health: ProjectHealth;
  setHealth: (value: ProjectHealth) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  owners: CreateProjectOwnerOption[];
  internsLoading: boolean;
  fieldError: (key: CreateProjectFieldErrorKey) => string;
  pwStrength: "weak" | "fair" | "strong" | null;
  submit: () => void | Promise<void>;
  companyTypeValid: boolean;
  canSubmit: boolean;
};

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
  showManagerPicker,
  managers,
  managersLoading,
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
  } = props;

  return (
    <>
      <fieldset disabled={submitting} className="border-0 m-0 p-0 space-y-6">
        <CreateFormSection
          eyebrow="GCC setup project"
          hint="GCC entity, parent entity details, starting phase, health, and who owns delivery."
        >
          <div>
            <Label htmlFor="create-company-name" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
              <Building2 className="w-3.5 h-3.5" aria-hidden />
              Parent company name <span className="text-danger font-normal">*</span>
            </Label>
            <Input
              id="create-company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. ABC India GCC Pvt Ltd"
              className={cn(
                "mt-1.5 h-9 text-[13px]",
                fieldError("companyName") && "border-danger focus-visible:ring-danger/30",
              )}
              aria-invalid={!!fieldError("companyName")}
              aria-describedby={fieldError("companyName") ? "create-company-name-error" : undefined}
              autoFocus
              maxLength={120}
            />
            <FieldError id="create-company-name-error" message={fieldError("companyName")} />
            {!fieldError("companyName") && (
              <p className="text-[11px] text-text-tertiary mt-1">
                Short name for this GCC setup project in VCFO Suite.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="create-parent-entity-name" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
              <Building2 className="w-3.5 h-3.5" aria-hidden />
              Parent entity legal name <span className="text-danger font-normal">*</span>
            </Label>
            <Input
              id="create-parent-entity-name"
              value={parentEntityName}
              onChange={(e) => setParentEntityName(e.target.value)}
              placeholder="e.g. ABC Holdings Limited"
              className={cn(
                "mt-1.5 h-9 text-[13px]",
                fieldError("parentEntityName") && "border-danger focus-visible:ring-danger/30",
              )}
              aria-invalid={!!fieldError("parentEntityName")}
              aria-describedby={
                fieldError("parentEntityName") ? "create-parent-entity-name-error" : "create-parent-entity-name-hint"
              }
              maxLength={240}
            />
            <FieldError id="create-parent-entity-name-error" message={fieldError("parentEntityName")} />
            {!fieldError("parentEntityName") && (
              <p id="create-parent-entity-name-hint" className="text-[11px] text-text-tertiary mt-1">
                Full legal name as on the certificate of incorporation or equivalent charter document.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="create-parent-entity-address" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
              <MapPin className="w-3.5 h-3.5" aria-hidden />
              Parent entity registered address <span className="text-danger font-normal">*</span>
            </Label>
            <Textarea
              id="create-parent-entity-address"
              value={parentEntityAddress}
              onChange={(e) => setParentEntityAddress(e.target.value)}
              placeholder={"e.g. 100 Market Street, Suite 400\nSan Francisco, CA 94105\nUnited States of America"}
              className={cn(
                "mt-1.5 min-h-[88px] text-[13px] resize-y",
                fieldError("parentEntityAddress") && "border-danger focus-visible:ring-danger/30",
              )}
              aria-invalid={!!fieldError("parentEntityAddress")}
              aria-describedby={
                fieldError("parentEntityAddress") ? "create-parent-entity-address-error" : "create-parent-entity-address-hint"
              }
              maxLength={2000}
              rows={3}
            />
            <FieldError id="create-parent-entity-address-error" message={fieldError("parentEntityAddress")} />
            {!fieldError("parentEntityAddress") && (
              <p id="create-parent-entity-address-hint" className="text-[11px] text-text-tertiary mt-1">
                Full registered office address including street, city, state or province, postal code, and country.
              </p>
            )}
          </div>

          <div>
            <span id="create-company-type-label" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
              <Globe2 className="w-3.5 h-3.5" aria-hidden />
              Entity origin <span className="text-danger font-normal">*</span>
            </span>
            <fieldset
              aria-labelledby="create-company-type-label"
              aria-describedby={fieldError("companyType") ? "create-company-type-error" : "create-company-type-hint"}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5 border-0 p-0 m-0 min-w-0"
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
                      "text-left rounded-md border px-2.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-brand bg-primary-light/60 ring-1 ring-brand/30" : "border-border hover:bg-muted/40",
                      fieldError("companyType") && !active && "border-danger/40",
                    )}
                  >
                    <div className={cn("text-[12px] font-medium", active ? "text-brand-deep" : "text-ink")}>
                      {opt.label}
                    </div>
                    <div className="text-[10.5px] text-text-tertiary mt-0.5 leading-tight">{opt.hint}</div>
                  </button>
                );
              })}
            </fieldset>
            <FieldError id="create-company-type-error" message={fieldError("companyType")} />
            {!fieldError("companyType") && (
              <p id="create-company-type-hint" className="text-[11px] text-text-tertiary mt-1">
                Domestic = India-incorporated. Foreign = overseas parent company on the FEMA / inbound track.
              </p>
            )}
          </div>

          <div>
            <span id="create-entity-legal-form-label" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
              <Layers className="w-3.5 h-3.5" aria-hidden />
              Entity legal form <span className="text-danger font-normal">*</span>
            </span>
            <fieldset
              aria-labelledby="create-entity-legal-form-label"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5 border-0 p-0 m-0 min-w-0"
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
                      "text-left rounded-md border px-2.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-brand bg-primary-light/60 ring-1 ring-brand/30" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <div className={cn("text-[12px] font-medium", active ? "text-brand-deep" : "text-ink")}>
                      {opt.label}
                    </div>
                    <div className="text-[10.5px] text-text-tertiary mt-0.5 leading-tight">{opt.hint}</div>
                  </button>
                );
              })}
            </fieldset>
            <p className="text-[11px] text-text-tertiary mt-1">
              Drives which recurring compliances appear on the compliance calendar for this project.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showManagerPicker ? (
              <div>
                <Label htmlFor="create-manager" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
                  <User className="w-3.5 h-3.5" aria-hidden />
                  Project manager <span className="text-danger font-normal">*</span>
                </Label>
                <Select
                  value={managerId}
                  onValueChange={setManagerId}
                  disabled={managersLoading}
                >
                  <SelectTrigger id="create-manager" className="mt-1.5 h-9 text-[13px]">
                    <SelectValue placeholder={managersLoading ? 'Loading managers…' : 'Assign project manager'} />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="py-2">
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="text-[13px] font-medium">{m.name}</span>
                          <span className="text-[10.5px] text-text-tertiary font-mono">{m.email}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="create-manager-error" message={fieldError('managerId')} />
              </div>
            ) : null}
            <div>
              <Label htmlFor="create-intern" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
                <User className="w-3.5 h-3.5" aria-hidden />
                Delivery owner (project lead)
              </Label>
              <Select value={internId} onValueChange={setInternId} disabled={internsLoading}>
                <SelectTrigger id="create-intern" className="mt-1.5 h-9 text-[13px]">
                  <SelectValue placeholder={internsLoading ? 'Loading team…' : 'Choose delivery owner'} />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((t) => {
                    const email = "email" in t && typeof t.email === "string" ? t.email : undefined;
                    return (
                      <SelectItem key={t.id} value={t.id} className="py-2">
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="text-[13px] font-medium">{t.name}</span>
                          <span className="text-[10.5px] text-text-tertiary font-mono">{email ?? t.initials}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-health" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
                <Activity className="w-3.5 h-3.5" aria-hidden />
                Portfolio health
              </Label>
              <Select value={health} onValueChange={(v) => setHealth(v as typeof health)}>
                <SelectTrigger id="create-health" className="mt-1.5 h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_OPTIONS.map((h) => (
                    <SelectItem key={h.value} value={h.value} className="py-2">
                      <span className="flex flex-col items-start gap-0.5">
                        <span>{h.label}</span>
                        <span className="text-[10.5px] text-text-tertiary">{h.hint}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <span id="create-phase-label" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
              <Layers className="w-3.5 h-3.5" aria-hidden />
              Starting setup phase
            </span>
            <fieldset
              aria-labelledby="create-phase-label"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5 border-0 p-0 m-0 min-w-0"
            >
              {PHASES.map((p) => {
                const active = stage === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setStage(p.value)}
                    aria-pressed={active}
                    className={cn(
                      "text-left rounded-md border px-2.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-brand bg-primary-light/60 ring-1 ring-brand/30" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <div className={cn("text-[12px] font-medium", active ? "text-brand-deep" : "text-ink")}>
                      {p.label}
                    </div>
                    <div className="text-[10.5px] text-text-tertiary mt-0.5 leading-tight">{p.hint}</div>
                  </button>
                );
              })}
            </fieldset>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <div className="text-[11.5px] font-medium text-text-secondary uppercase tracking-wider">
                Setup phase preview
              </div>
              <div className="text-[10.5px] text-text-tertiary shrink-0">
                Entry point · <span className="text-ink font-medium">{stage}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {PHASE_ORDER.map((p, idx) => {
                const startIdx = PHASE_ORDER.indexOf(stage);
                const state: "done" | "current" | "upcoming" =
                  idx < startIdx ? "done" : idx === startIdx ? "current" : "upcoming";
                const Icon = state === "done" ? CheckCircle2 : state === "current" ? Clock : Circle;
                const iconCls =
                  state === "done" ? "text-success" : state === "current" ? "text-brand" : "text-text-tertiary";
                return (
                  <div key={p} className="flex gap-2.5">
                    <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", iconCls)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-[12px] font-medium",
                          state === "upcoming" ? "text-text-tertiary" : "text-ink",
                        )}
                      >
                        {p}
                        {state === "current" && (
                          <span className="ml-1.5 text-[10px] text-brand font-normal">· entry phase</span>
                        )}
                        {state === "done" && (
                          <span className="ml-1.5 text-[10px] text-success font-normal">· prior phase</span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-text-tertiary mt-0.5 leading-snug">
                        {PHASE_MILESTONES[p].join(" · ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CreateFormSection>
      </fieldset>
      <CreateProjectFormClientSection {...props} />
    </>
  );
}
