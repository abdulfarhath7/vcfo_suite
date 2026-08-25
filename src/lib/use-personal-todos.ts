'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isCustomInternFocus,
  readInternFocus,
  writeInternFocus,
  type InternFocusEntry,
  type InternWorkItem,
} from '@/lib/intern-work';
import {
  focusEntryToCreateBody,
  personalTodoToFocusEntry,
  type PersonalTodoDto,
} from '@/lib/personal-todos';

export const PERSONAL_TODOS_QUERY_KEY = ['personal-todos'] as const;

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'request_failed');
  }
  return data;
}

export async function fetchPersonalTodos(): Promise<PersonalTodoDto[]> {
  const data = await readJson<{ todos: PersonalTodoDto[] }>(await fetch('/api/todos'));
  return data.todos;
}

async function createPersonalTodoRequest(entry: InternFocusEntry): Promise<PersonalTodoDto> {
  return (
    await readJson<{ todo: PersonalTodoDto }>(
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(focusEntryToCreateBody(entry)),
      }),
    )
  ).todo;
}

async function patchPersonalTodoRequest(
  dbId: string,
  patch: { done?: boolean; title?: string },
): Promise<PersonalTodoDto> {
  return (
    await readJson<{ todo: PersonalTodoDto }>(
      await fetch(`/api/todos/${dbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    )
  ).todo;
}

async function deletePersonalTodoRequest(dbId: string): Promise<void> {
  await readJson<{ ok: boolean }>(
    await fetch(`/api/todos/${dbId}`, { method: 'DELETE' }),
  );
}

export function usePersonalTodos(enabled = true) {
  return useQuery({
    queryKey: PERSONAL_TODOS_QUERY_KEY,
    queryFn: fetchPersonalTodos,
    enabled,
    staleTime: 15_000,
  });
}

function pruneFocus(entries: InternFocusEntry[], items: InternWorkItem[]): InternFocusEntry[] {
  if (items.length === 0) return entries;
  const ids = new Set(items.map((item) => item.id));
  return entries.filter((row) => isCustomInternFocus(row) || ids.has(row.id));
}

async function syncFocusDiff(
  prev: InternFocusEntry[],
  next: InternFocusEntry[],
): Promise<InternFocusEntry[]> {
  const prevById = new Map(prev.map((entry) => [entry.id, entry]));
  const nextIds = new Set(next.map((entry) => entry.id));
  const result = next.map((entry) => ({ ...entry }));

  for (const entry of prev) {
    if (nextIds.has(entry.id) || !entry.dbId) continue;
    await deletePersonalTodoRequest(entry.dbId);
  }

  for (let i = 0; i < result.length; i += 1) {
    const entry = result[i];
    const before = prevById.get(entry.id);
    if (!before) {
      const created = await createPersonalTodoRequest(entry);
      result[i] = personalTodoToFocusEntry(created);
      continue;
    }
    const titleChanged = (entry.title ?? '') !== (before.title ?? '');
    const doneChanged = Boolean(entry.done) !== Boolean(before.done);
    if (!titleChanged && !doneChanged) {
      if (!entry.dbId && before.dbId) result[i] = { ...entry, dbId: before.dbId };
      continue;
    }
    const dbId = entry.dbId ?? before.dbId;
    if (dbId) {
      const updated = await patchPersonalTodoRequest(dbId, {
        done: entry.done,
        title: entry.title,
      });
      result[i] = personalTodoToFocusEntry(updated);
    } else {
      const created = await createPersonalTodoRequest(entry);
      result[i] = personalTodoToFocusEntry(created);
    }
  }

  return result;
}

export function useOwnFocusTodos(userId: string, items: InternWorkItem[]) {
  const queryClient = useQueryClient();
  const listQuery = usePersonalTodos(Boolean(userId));
  const [focus, setFocus] = useState<InternFocusEntry[]>(() =>
    userId ? readInternFocus(userId) : [],
  );
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const hydratedUserRef = useRef<string | null>(null);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  useEffect(() => {
    hydratedUserRef.current = null;
    setFocus(userId ? readInternFocus(userId) : []);
  }, [userId]);

  useEffect(() => {
    if (!userId || !listQuery.isSuccess) return;
    if (hydratedUserRef.current === userId) return;
    hydratedUserRef.current = userId;

    const mine = (listQuery.data ?? [])
      .filter((todo) => todo.ownerId === userId)
      .map(personalTodoToFocusEntry);
    const local = readInternFocus(userId);
    const serverIds = new Set(mine.map((entry) => entry.id));
    const extras = local.filter((entry) => !serverIds.has(entry.id));
    const merged = pruneFocus([...mine, ...extras], items);

    focusRef.current = merged;
    setFocus(merged);
    writeInternFocus(userId, merged);

    if (extras.length === 0) return;
    void (async () => {
      try {
        const synced = await syncFocusDiff(mine, merged);
        if (hydratedUserRef.current !== userId) return;
        focusRef.current = synced;
        setFocus(synced);
        writeInternFocus(userId, synced);
        await queryClient.invalidateQueries({ queryKey: PERSONAL_TODOS_QUERY_KEY });
      } catch {
        /* local cache stands */
      }
    })();
  }, [userId, items, listQuery.isSuccess, listQuery.data, queryClient]);

  useEffect(() => {
    if (!userId || items.length === 0) return;
    const prev = focusRef.current;
    const valid = prev.filter((row) => isCustomInternFocus(row) || byId.has(row.id));
    if (valid.length === prev.length) return;
    focusRef.current = valid;
    setFocus(valid);
    writeInternFocus(userId, valid);
    void (async () => {
      try {
        await syncFocusDiff(prev, valid);
        await queryClient.invalidateQueries({ queryKey: PERSONAL_TODOS_QUERY_KEY });
      } catch {
        /* local cache stands */
      }
    })();
  }, [userId, items, byId, queryClient]);

  const persist = useCallback(
    (next: InternFocusEntry[]) => {
      if (!userId) return;
      const prev = focusRef.current;
      const pruned = pruneFocus(next, items);
      focusRef.current = pruned;
      setFocus(pruned);
      writeInternFocus(userId, pruned);
      void (async () => {
        try {
          const synced = await syncFocusDiff(prev, pruned);
          if (hydratedUserRef.current !== userId && hydratedUserRef.current !== null) return;
          focusRef.current = synced;
          setFocus(synced);
          writeInternFocus(userId, synced);
          await queryClient.invalidateQueries({ queryKey: PERSONAL_TODOS_QUERY_KEY });
        } catch {
          /* local cache stands */
        }
      })();
    },
    [userId, items, queryClient],
  );

  return { focus, persist, byId };
}
