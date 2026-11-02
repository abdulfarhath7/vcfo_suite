'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Pencil, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/admin/create-project-form-shared';
import { CreateProjectQuestionnaire } from '@/components/admin/CreateProjectQuestionnaire';
import { questionnaireProgress } from '@/data/compliance-questionnaire';
import {
  CreateProjectFormFlow,
  type FormFlowSection,
} from '@/components/admin/CreateProjectPhasePath';
import { CreateProjectClientFields } from '@/components/admin/CreateProjectFormClientSection';
import type {
  CreateProjectFormViewProps,
} from '@/components/admin/create-project-form-view-shared';
import { SectionTabs } from '@/components/admin/CreateProjectSectionTabs';
import { deriveCreateProjectView } from '@/components/admin/create-project-form-derive';
import { renderEntitySection } from '@/components/admin/CreateProjectEntitySection';
import { renderTeamSection } from '@/components/admin/CreateProjectTeamSection';

export type { CreateProjectFormViewProps } from '@/components/admin/create-project-form-view-shared';

export function CreateProjectFormView(props: CreateProjectFormViewProps) {
  const {
    onCancel,
    submitting,
    companyName,
    setCompanyName,
    questionnaire,
    setQuestionnaire,
    fieldError,
    submit,
    saveDraft,
    editMode,
    existingClientEmail,
    onChangeClientEmail,
    canChangeClientEmail,
    changeClientNeedsApproval,
  } = props;

  const derived = deriveCreateProjectView(props);
  const {
    entityDone,
    teamDone,
    clientDone,
    internErr,
    managerErr,
    entityErr,
    clientErr,
  } = derived;
  const sectionCtx = { ...props, ...derived };

  const [activeSection, setActiveSection] = useState<FormFlowSection>('entity');
  /** Filled + blurred = plain title; click brings the field back. */
  const [nameEditing, setNameEditing] = useState(false);
  const nameFieldVisible =
    nameEditing || !companyName.trim() || Boolean(fieldError('companyName'));


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
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-surface-raised">
          <div className="px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
            <Label htmlFor="create-company-name" className="text-[12px] text-ink-muted">
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
                // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
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
                  className="h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
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
            {activeSection === 'entity' ? renderEntitySection(sectionCtx) : null}

            {activeSection === 'team' ? renderTeamSection(sectionCtx) : null}

            {activeSection === 'client' ? (
              <div id="create-section-client">
                {editMode ? (
                  <div className="grid max-w-xl grid-cols-1 gap-5">
                    <div>
                      <Label
                        htmlFor="edit-client-contact"
                        className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted"
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
                        className="text-[12.5px] font-medium text-ink-muted"
                      >
                        Portal sign-in email
                      </Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          id="edit-client-email"
                          value={existingClientEmail || '—'}
                          disabled
                          readOnly
                          className="h-11 flex-1 px-3.5 text-[14px]"
                        />
                        {canChangeClientEmail && onChangeClientEmail ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 shrink-0"
                            onClick={onChangeClientEmail}
                          >
                            {changeClientNeedsApproval ? 'Request change' : 'Change email'}
                          </Button>
                        ) : null}
                      </div>
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
