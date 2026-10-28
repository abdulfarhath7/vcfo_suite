'use client';

import { CardHeadTile } from '@/components/common/CardHeadTile';
import { useMemo } from 'react';
import { ROLE_UI_LABEL } from '@/lib/auth';
import { groupOpenPersonalTodosByOwner } from '@/lib/intern/personal-todos';
import { usePersonalTodos } from '@/hooks/use-personal-todos';
import { PersonCell } from '@/components/staff/today/today-parts';

/**
 * Team todos: every teammate's open personal to-dos, grouped by person. Full-width rows with a
 * hairline between them (R-19).
 */
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
  const total = groups.reduce((n, g) => n + g.todos.length, 0);

  return (
    <section className="surface h-fit min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] min-w-0 items-center gap-2.5 border-b border-line-soft px-4 py-2">
        <CardHeadTile title="Team todos" />
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Team todos</h2>
        {total > 0 ? <span className="shrink-0 text-[12.5px] text-ink-muted">{total}</span> : null}
      </div>

      {query.isError ? (
        <p className="px-4 py-3 text-[13px] text-ink-muted">Couldn’t load todos.</p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-ink-muted">No open todos.</p>
      ) : (
        <div className="max-h-[min(24rem,50vh)] overflow-y-auto">
          {groups.map((group) => (
            <div key={group.ownerId} className="border-t border-line-soft first:border-t-0">
              <div className="flex min-w-0 items-center gap-2 px-4 pb-1 pt-2.5 text-[13px] font-medium text-ink">
                <PersonCell name={group.ownerName} full />
                <span className="ml-auto shrink-0 text-[12px] font-normal text-ink-muted">
                  {ROLE_UI_LABEL[group.ownerRole] ?? group.ownerRole}
                </span>
              </div>
              <ul>
                {group.todos.map((todo) => (
                  <li
                    key={todo.id}
                    className="truncate border-t border-line-soft px-4 py-2 pl-12 text-[13px] text-ink-2 first:border-t-0"
                    title={todo.title}
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
