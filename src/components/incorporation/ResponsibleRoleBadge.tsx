'use client';

import { UserRound } from 'lucide-react';
import type { ChecklistResponsibleRole } from '@/data/checklist';
import { RESPONSIBLE_ROLE_LABEL } from '@/lib/checklist-field-access';
import { cn } from '@/lib/utils';

interface ResponsibleRoleBadgeProps {
  role?: ChecklistResponsibleRole;
  className?: string;
  /** Intern journey rail: person icon only (no Client / Project lead words). */
  iconOnly?: boolean;
}

/** Subtle owner chip for checklist steps — Client or Project Lead. */
export function ResponsibleRoleBadge({ role, className, iconOnly }: ResponsibleRoleBadgeProps) {
  if (!role) return null;

  const label = RESPONSIBLE_ROLE_LABEL[role];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full text-[10px] font-medium',
        iconOnly ? 'p-0.5' : 'px-2 py-0.5',
        role === 'client'
          ? 'bg-raised/80 text-text-secondary'
          : 'bg-info-light text-info-text',
        className,
      )}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
    >
      <UserRound className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}

