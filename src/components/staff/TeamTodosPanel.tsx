'use client';

import { useMemo } from 'react';
import { ROLE_UI_LABEL } from '@/lib/auth';
import { groupOpenPersonalTodosByOwner } from '@/lib/personal-todos';
import { usePersonalTodos } from '@/lib/use-personal-todos';

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
      <div className="flex min-w-0 items-start justify-between gap-3 px-4 pt-3">
        <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">Todos</h2>
      </div>

      {query.isError ? (
        <p className="px-4 pb-3 pt-2 text-[13px] text-muted-foreground">Couldn’t load todos.</p>
      ) : groups.length === 0 ? (
        <p className="px-4 pb-3 pt-2 text-[13px] text-muted-foreground">No open todos.</p>
      ) : (
        <div className="max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto px-4 pb-3 pt-2">
          {groups.map((group) => (
            <div key={group.ownerId}>
              <div className="mb-1.5 flex min-w-0 items-baseline gap-2">
                <p className="truncate text-[13px] font-semibold text-ink">{group.ownerName}</p>
                <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                  {ROLE_UI_LABEL[group.ownerRole] ?? group.ownerRole}
                </span>
              </div>
              <ul className="space-y-1.5">
                {group.todos.map((todo) => (
                  <li
                    key={todo.id}
                    className="rounded-xl bg-raised/60 px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-border/70"
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
