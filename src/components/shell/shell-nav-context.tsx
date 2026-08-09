'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ShellNavContextValue = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
  isLgUp: boolean;
};

const ShellNavContext = createContext<ShellNavContextValue | null>(null);

export function ShellNavProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLgUp, setIsLgUp] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setIsLgUp(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo(
    () => ({ mobileOpen, setMobileOpen, openMobile, closeMobile, isLgUp }),
    [mobileOpen, openMobile, closeMobile, isLgUp],
  );

  return <ShellNavContext.Provider value={value}>{children}</ShellNavContext.Provider>;
}

export function useShellNav() {
  const ctx = useContext(ShellNavContext);
  if (!ctx) {
    throw new Error('useShellNav must be used within ShellNavProvider');
  }
  return ctx;
}
