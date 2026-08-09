// Compatibility re-export. The real implementation is the Auth.js-backed guard.
export {
  requireManager,
  requireAdmin,
  requireAdminOrManager,
} from '@/auth/guards';
export type { AuthContext as ManagerContext } from '@/auth/guards';

