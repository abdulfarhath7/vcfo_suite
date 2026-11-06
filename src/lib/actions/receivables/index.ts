import 'server-only';

import type { AnyAction } from '../types';
import { records, removeInvoice } from './invoices';
import { outward } from './outward';
import { reads } from './reads';

/** A sheet is on no project, so none of these waits for a client to be named. */
export const actions: AnyAction[] = [...reads, ...records, removeInvoice, ...outward].map((action) => ({ ...action, firmWide: true }));
