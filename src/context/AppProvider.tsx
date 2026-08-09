"use client";

import { ReactNode } from 'react';
import { AppContext } from '@/context/app-context-store';
import { useAppProviderValue } from '@/context/use-app-provider-value';

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppProviderValue();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
