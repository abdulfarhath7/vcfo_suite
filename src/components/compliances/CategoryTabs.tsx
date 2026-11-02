'use client';

import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import type { Category, CatFilter } from '@/views/compliances/tasks/task-model';

/**
 * The statutory and non-statutory switch with counts. Obligations lists Statutory first and
 * makes it the default (S-1); Calendar and Filings list All first (C-1, F-1).
 */
export function CategoryTabs({
  value,
  onChange,
  stat,
  ns,
  className,
}: {
  value: Category;
  onChange: (c: Category) => void;
  stat: number;
  ns: number;
  className?: string;
}) {
  return (
    <SpectrumTabs
      label="Category"
      className={className}
      items={[
        { key: 'stat', label: 'Statutory', count: stat },
        { key: 'ns', label: 'Non-statutory', count: ns },
        { key: 'all', label: 'All', count: stat + ns },
      ]}
      value={value}
      onChange={(k) => onChange(k as Category)}
    />
  );
}

export function CatFilterTabs({
  value,
  onChange,
  stat,
  ns,
  className,
}: {
  value: CatFilter;
  onChange: (c: CatFilter) => void;
  stat: number;
  ns: number;
  className?: string;
}) {
  return (
    <SpectrumTabs
      label="Category"
      className={className}
      items={[
        { key: 'all', label: 'All', count: stat + ns },
        { key: 'statutory', label: 'Statutory', count: stat },
        { key: 'non-statutory', label: 'Non-statutory', count: ns },
      ]}
      value={value}
      onChange={(k) => onChange(k as CatFilter)}
    />
  );
}
