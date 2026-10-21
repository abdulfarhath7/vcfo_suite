import {
  stageRequiresParentEntity,
  stageRequiresSubsidiary,
} from '@/components/admin/create-project-form-utils';
import { requiresParentIndianRelationship } from '@/data/engagements';
import { resolveNocVariant } from '@/lib/noc/variant';
import type {
  CreateProjectFormViewProps,
} from '@/components/admin/create-project-form-view-shared';

/**
 * Values the form view derives from its props alone: which entity fields the
 * stage and ownership need, section completion, the manager and lead slot
 * helpers, and the per-section error flags.
 */
export function deriveCreateProjectView(props: CreateProjectFormViewProps) {
  const {
    ownershipType,
    companyType,
    parentIndianRelationship,
    subsidiaryLegalName,
    subsidiaryRegisteredAddress,
    parentEntityName,
    parentEntityAddress,
    internIds,
    setInternIds,
    managerIds,
    setManagerIds,
    lockFirstManager,
    selfManagerId,
    showManagerPicker,
    managers,
    stage,
    owners,
    fieldError,
    editMode,
  } = props;

  const independent = ownershipType === 'independent';
  const needsSubsidiary = stageRequiresSubsidiary(stage, ownershipType);
  const needsParent = stageRequiresParentEntity(stage, ownershipType);
  const needsParentRole = requiresParentIndianRelationship({ ownershipType, companyType });
  const nocVariant = resolveNocVariant({ ownershipType, companyType, parentIndianRelationship });
  const entityDone = Boolean(
    companyType &&
      (!needsParentRole || parentIndianRelationship) &&
      (!needsSubsidiary ||
        (subsidiaryLegalName.trim() && subsidiaryRegisteredAddress.trim())) &&
      (!needsParent || (parentEntityName.trim() && parentEntityAddress.trim())),
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

  const internErr = fieldError('internId');
  const managerErr = fieldError('managerId');
  const entityErr =
    fieldError('companyName') ||
    fieldError('companyType') ||
    fieldError('parentIndianRelationship') ||
    fieldError('subsidiaryLegalName') ||
    fieldError('subsidiaryRegisteredAddress') ||
    fieldError('parentEntityName') ||
    fieldError('parentEntityAddress');
  const clientErr = fieldError('clientEmail') || fieldError('clientPassword');

  return {
    independent,
    needsSubsidiary,
    needsParent,
    needsParentRole,
    nocVariant,
    entityDone,
    teamDone,
    clientDone,
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
    internErr,
    managerErr,
    entityErr,
    clientErr,
  };
}

export type CreateProjectViewDerived = ReturnType<typeof deriveCreateProjectView>;
