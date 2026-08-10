import { NextResponse } from 'next/server';
import { requireAdminOrManager } from '@/auth/guards';
import { deleteProfileAccount } from '@/db/repositories/profiles';
import { recordAuditEvent } from '@/db/repositories/audit-events';

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/admin/people/[id] — admin: anyone; manager: their leads. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireAdminOrManager();
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  try {
    const deleted = await deleteProfileAccount(auth.ctx, id.trim());
    await recordAuditEvent(auth.ctx, {
      action: 'account.delete',
      summary: `Deleted ${deleted.role} account ${deleted.name}`,
      metadata: { email: deleted.email, role: deleted.role, deletedId: deleted.deletedId },
    });
    return NextResponse.json({ ok: true, ...deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed';
    const status =
      message === 'not_found'
        ? 404
        : message === 'cannot_delete_self' ||
            message === 'cannot_delete_last_admin' ||
            message === 'managers_may_only_delete_leads' ||
            message === 'lead_not_in_your_roster'
          ? 403
          : 400;
    const friendly: Record<string, string> = {
      cannot_delete_self: 'You cannot delete your own account.',
      cannot_delete_last_admin: 'Cannot delete the last firm admin.',
      managers_may_only_delete_leads: 'Managers can only delete project leads.',
      lead_not_in_your_roster: 'That project lead is not on your roster.',
      not_found: 'Account not found.',
      account_still_referenced: 'Account is still linked to firm data. Try again or contact support.',
    };
    return NextResponse.json(
      { ok: false, error: friendly[message] ?? message },
      { status },
    );
  }
}
