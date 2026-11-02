'use client';

/**
 * Sidebar extras per seat, keyed by nav item: a component rendered under that item in the hover panel
 * (prototype: the lead list under Project leads, pinned clients under Clients), and '@mini' for the
 * small calendar above the sidebar foot (prototype #mx-mini). Pages' agents register theirs here.
 */
import type { ComponentType } from 'react';
import type { Seat } from '../runtime';
import { LeadsExtra } from './mgr/LeadsExtra';
import { ClientsExtra } from './mgr/ClientsExtra';
import { MiniCal } from './mgr/MiniCal';

export const SEAT_EXTRAS: Partial<Record<Seat, Partial<Record<string, ComponentType>>>> = {
  /* manager: lead list under Project leads, pinned clients under Clients, this month's calendar above the foot */
  mgr: { leads: LeadsExtra, clients: ClientsExtra, '@mini': MiniCal },
  /* project lead: their clients (overdue first) under Clients, this month's calendar of their filings */
  lead: { clients: ClientsExtra, '@mini': MiniCal },
};
