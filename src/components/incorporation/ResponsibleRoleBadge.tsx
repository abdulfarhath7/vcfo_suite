'use client';

import { UserRound } from 'lucide-react';
import type { ChecklistResponsibleRole } from '@/data/checklist';
import { RESPONSIBLE_ROLE_LABEL } from '@/lib/checklist-field-access';
import { cn } from '@/lib/utils';

interface ResponsibleRoleBadgeProps {
  role?: ChecklistResponsibleRole;
  className?: string;
}

/** Subtle owner chip for checklist steps — Client or Project Lead. */
export function ResponsibleRoleBadge({ role, className }: ResponsibleRoleBadgeProps) {
  if (!role) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        role === 'client'
          ? 'bg-raised/80 text-text-secondary'
          : 'bg-info-light text-info-text',
        className,
      )}
    >
      <UserRound className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      {RESPONSIBLE_ROLE_LABEL[role]}
    </span>
  );
}

