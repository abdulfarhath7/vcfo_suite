import 'server-only';
import type { AuthContext } from '@/auth/guards';
import {
  createInternProfile,
  type CreateInternProfileInput,
  type CreateInternProfileResult,
} from '@/db/repositories/profiles';

export type CreateInternUserInput = CreateInternProfileInput;
export type CreateInternUserResult = CreateInternProfileResult;

/**
 * Creates an intern (project lead) profile with a bcrypt password hash.
 * Admin/manager gate belongs in the API route (`requireAdminOrManager`);
 * the repository also double-checks role.
 */
export async function createInternUser(
  ctx: AuthContext,
  input: CreateInternUserInput,
): Promise<CreateInternUserResult> {
  return createInternProfile(ctx, input);
}
