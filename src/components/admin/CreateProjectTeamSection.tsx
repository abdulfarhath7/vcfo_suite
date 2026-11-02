import { User, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  type CreateProjectFormViewProps,
  fieldLabelClass,
  fieldControlClass,
} from '@/components/admin/create-project-form-view-shared';
import type { CreateProjectViewDerived } from '@/components/admin/create-project-form-derive';

/** The Team section: project managers and project leads, one picker per slot. */
export function renderTeamSection(ctx: CreateProjectFormViewProps & CreateProjectViewDerived) {
  const {
    internIds,
    managerIds,
    lockFirstManager,
    showManagerPicker,
    managers,
    managersLoading,
    owners,
    internsLoading,
    fieldError,
    editMode,
    lockedManager,
    availableManagersForSlot,
    availableLeadsForSlot,
    canAddManager,
    canAddLead,
    updateManagerAt,
    removeManagerAt,
    addManager,
    updateLeadAt,
    removeLeadAt,
    addLead,
  } = ctx;

  return (
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
                        'flex w-full items-center rounded-md border border-line/80 bg-surface-sunken/30 px-3.5',
                      )}
                    >
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="text-[13px] font-medium text-ink">
                          {lockedManager?.name ?? 'You'}
                          <span className="ml-2 text-[11px] font-normal text-ink-muted">
                            (you)
                          </span>
                        </span>
                        {lockedManager?.email ? (
                          <span className="font-mono text-[11px] text-ink-muted">
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
                              <span className="font-mono text-[11px] text-ink-muted">
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
                      className="mt-0.5 h-11 w-11 shrink-0 text-ink-muted hover:text-ink"
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
                              <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                                primary
                              </span>
                            ) : null}
                          </span>
                          <span className="font-mono text-[11px] text-ink-muted">
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
                  className="mt-0.5 h-11 w-11 shrink-0 text-ink-muted hover:text-ink"
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
  );
}
