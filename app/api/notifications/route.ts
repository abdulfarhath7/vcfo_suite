import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import {
  createNotification,
  createNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/db/repositories/notifications';
import type { AppNotification } from '@/lib/checklist-notifications';

/** GET /api/notifications */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const notifications = await listNotifications(guard.ctx);
    return NextResponse.json({ notifications });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/notifications — create one or many; or mark read. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  let body: {
    action?: string;
    id?: string;
    notification?: Omit<AppNotification, 'id' | 'read' | 'createdAt'>;
    notifications?: Array<Omit<AppNotification, 'id' | 'read' | 'createdAt'>>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.action === 'mark_read') {
    if (!body.id) {
      return NextResponse.json({ error: 'id_required' }, { status: 400 });
    }
    const notification = await markNotificationRead(guard.ctx, body.id);
    if (!notification) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ notification });
  }

  if (body.action === 'mark_all_read') {
    const count = await markAllNotificationsRead(guard.ctx);
    return NextResponse.json({ count });
  }

  if (body.notifications && Array.isArray(body.notifications)) {
    const notifications = await createNotifications(guard.ctx, body.notifications);
    return NextResponse.json({ notifications }, { status: 201 });
  }

  if (body.notification) {
    const notification = await createNotification(guard.ctx, body.notification);
    return NextResponse.json({ notification }, { status: 201 });
  }

  return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
}
