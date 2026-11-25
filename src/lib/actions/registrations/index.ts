import type { AnyAction } from '../types';
import { setExpiry } from './set-expiry';
import { setField } from './set-field';

export const actions: AnyAction[] = [setExpiry, setField];
