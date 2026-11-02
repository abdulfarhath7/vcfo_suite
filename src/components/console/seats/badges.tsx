'use client';

/**
 * Sidebar badges for every page of a seat. A page's count (steps waiting for approval, unread
 * notifications …) is published once here, at the frame, so the badge shows on whichever page the person
 * opens first, not only after they visit the page that owns it. Each area exports its badge hook
 * (`use<Name>Badge()`); add it to the seat's publisher below. Pages may publish the same key too: equal
 * values are ignored (runtime `setBadge`). The bells' badges (`notes`, `anns`, `regulatory`) are published
 * by `useConsoleUpdates()` in the top bar.
 */
import type { ComponentType } from 'react';
import { useApprovalsBadge, useDateRequestsBadge } from '../pages/approvals/data';
import { useComplianceBadges } from '../pages/compliance/data';
import { useLeadBadges } from '../pages/lead/badges';
import { useLeadsBadge } from '../pages/leads/badges';
import { useWorkBadge } from '../pages/work/badges';
import type { Seat } from '../runtime';

function MgrBadges() {
  useApprovalsBadge();
  useDateRequestsBadge();
  useComplianceBadges();
  useWorkBadge();
  useLeadsBadge();
  return null;
}

/** `tasks` comes from the lead desk (`useLeadBadges`); `useLeadTasksBadge` (planner) would publish the same key. */
function LeadBadges() {
  useComplianceBadges();
  useLeadBadges();
  return null;
}

export const SEAT_BADGES: Partial<Record<Seat, ComponentType>> = { mgr: MgrBadges, lead: LeadBadges };
