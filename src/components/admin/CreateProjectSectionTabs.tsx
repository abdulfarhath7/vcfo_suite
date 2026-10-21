import { Building2, Check, ClipboardList, User, KeyRound } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { FormFlowSection } from '@/components/admin/CreateProjectPhasePath';

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
/** Underline tabs for the four form sections, with a check on each finished one. */
export function SectionTabs({
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
      className="flex gap-0.5 overflow-x-auto border-b border-line/70 px-2 sm:px-4"
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
              isActive ? 'text-brand' : 'text-ink-muted hover:text-ink',
            )}
          >
            {done ? (
              <span
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-positive text-white"
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
                className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-brand"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
