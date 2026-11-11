import type { StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import type { FyBounds } from './fy';
import type { CalendarSummary, ImportIssue } from './parse';

/** Shapes the statutory calendar routes return; shared by the repository, routes and the page. */

export type StatutoryCalendarSource = 'imported' | 'built-in' | 'none';

export interface StatutoryCalendarImport {
  fileName: string | null;
  importedAt: string;
  importedByName: string | null;
  rowCount: number;
}

export interface StatutoryCalendarView {
  fy: FyBounds;
  source: StatutoryCalendarSource;
  deadlines: StatutoryDeadline[];
  imported: StatutoryCalendarImport | null;
}

export interface StatutoryCalendarYear {
  fy: string;
  source: Exclude<StatutoryCalendarSource, 'none'>;
  rowCount: number;
}

/** GET /api/statutory-calendar */
export interface StatutoryCalendarResponse {
  calendar: StatutoryCalendarView;
  years: StatutoryCalendarYear[];
  /** The financial year that contains today, in India. */
  currentFy: string;
  canImport: boolean;
  /** The years the import dialog offers, when `canImport`. */
  importableYears: string[];
}

/** POST /api/statutory-calendar/import */
export interface StatutoryCalendarImportResponse {
  fy: FyBounds;
  fileName: string;
  published: boolean;
  summary: CalendarSummary;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  /** The calendar this import replaces, when the year already has one. */
  replaces: { source: Exclude<StatutoryCalendarSource, 'none'>; rowCount: number; importedAt: string | null; importedByName: string | null } | null;
}
