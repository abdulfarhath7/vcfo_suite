"use client";

import { createContext } from 'react';
import type { AppContextValue } from '@/context/AppContext';

export const AppContext = createContext<AppContextValue | null>(null);
