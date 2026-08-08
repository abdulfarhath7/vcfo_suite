'use client';

import { useApp } from '@/context/AppContext';
import {
  staffBasePathForRole,
  type StaffBasePath,
} from '@/lib/auth-routes';

export { staffBasePathForRole, type StaffBasePath };

export function useStaffBasePath(): StaffBasePath {
  const { user } = useApp();
  return staffBasePathForRole(user?.role);
}
