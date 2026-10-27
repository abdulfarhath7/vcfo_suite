'use client';

import { CardHeadTile } from '@/components/common/CardHeadTile';
import { useMemo } from 'react';
import { ROLE_UI_LABEL } from '@/lib/auth';
import { groupOpenPersonalTodosByOwner } from '@/lib/intern/personal-todos';
import { usePersonalTodos } from '@/hooks/use-personal-todos';

export function TeamTodosPanel({
  userId,
  excludeOwn = true,
}: {
  userId: string;
  excludeOwn?: boolean;
}) {
  const query = usePersonalTodos(Boolean(userId));
  const groups = useMemo(
    () =>
      groupOpenPersonalTodosByOwner(query.data ?? [], {
        viewerUserId: userId,
        excludeUserId: excludeOwn ? userId : undefined,
      }),
    [query.data, userId, excludeOwn],
  );

  return (
    <section className="surface h-fit min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] min-w-0 items-center gap-2.5 border-b border-line-soft px-4 py-2">
        <CardHeadTile title="Todos" />
        <h2 className="text-[14.5px] font-semibold text-ink">Todos</h2>
      </div>

      {query.isError ? (
        <p className="px-4 pb-3 pt-2 text-[13px] text-ink-muted">Couldn’t load todos.</p>
      ) : groups.length === 0 ? (
        <p className="px-4 pb-3 pt-2 text-[13px] text-ink-muted">No open todos.</p>
      ) : (
        <div className="max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto px-4 pb-3 pt-2">
          {groups.map((group) => (
            <div key={group.ownerId}>
              <div className="mb-1.5 flex min-w-0 items-baseline gap-2">
                <p className="truncate text-[13px] font-semibold text-ink">{group.ownerName}</p>
                <span className="shrink-0 text-[10.5px] font-medium tracking-[0.04em] text-ink-muted">
                  {ROLE_UI_LABEL[group.ownerRole] ?? group.ownerRole}
                </span>
              </div>
              <ul className="space-y-1.5">
                {group.todos.map((todo) => (
                  <li
                    key={todo.id}
                    className="rounded-xl bg-surface-sunken/60 px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line/70"
                  >
                    {todo.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
