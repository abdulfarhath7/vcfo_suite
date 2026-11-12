import { Building2, Check, ClipboardList, User, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tabStateClass } from '@/components/ui/tab-classes';
import type { FormFlowSection } from '@/components/admin/CreateProjectPhasePath';

const SECTION_TABS: Array<{ id: FormFlowSection; label: string; icon: typeof Building2 }> = [
  { id: 'entity', label: 'Entity details', icon: Building2 },
  { id: 'team', label: 'Team', icon: User },
  { id: 'client', label: 'Client portal', icon: KeyRound },
  { id: 'questionnaire', label: 'Questionnaire', icon: ClipboardList },
];

/**
 * Underline tabs for the four form sections, with a check on each finished one. The bar's
 * bottom border doubles as the card header rule; the open tab has the shared GL-03 look.
 */
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
      className="flex gap-1.5 overflow-x-auto border-b border-line/70 px-2 sm:px-4"
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
              '-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 text-[13px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              tabStateClass(isActive),
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
          </button>
        );
      })}
    </div>
  );
}
