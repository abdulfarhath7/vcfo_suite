import 'server-only';

import type { AnyAction } from '../types';
import { records, removeInvoice } from './invoices';
import { outward } from './outward';
import { reads } from './reads';

export const actions: AnyAction[] = [...reads, ...records, removeInvoice, ...outward];
