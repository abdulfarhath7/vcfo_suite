'use client';

import { useCallback, useEffect, useState } from 'react';

/** Mirrors `MailGroupDto` from `src/db/repositories/mail-groups.ts`. */
export interface MailGroup {
  id: string;
  name: string;
  shared: boolean;
  ownerId: string;
  canEdit: boolean;
  members: Array<{ email: string; name: string | null }>;
  createdAt: string;
}

export interface MailGroupDraft {
  name: string;
  shared: boolean;
  members: Array<{ email: string; name: string | null }>;
}

async function readJson<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

/** The caller's mail groups and the shared ones (G-23), with create, change and delete. */
export function useMailGroups() {
  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const json = await readJson<{ groups?: MailGroup[] }>(await fetch('/api/outlook/groups'));
      setGroups(json.groups ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload().catch(() => setGroups([]));
  }, [reload]);

  const create = useCallback(async (draft: MailGroupDraft) => {
    const json = await readJson<{ group: MailGroup }>(
      await fetch('/api/outlook/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }),
    );
    setGroups((prev) => [...prev, json.group].sort((a, b) => a.name.localeCompare(b.name)));
    return json.group;
  }, []);

  const update = useCallback(async (id: string, draft: Partial<MailGroupDraft>) => {
    const json = await readJson<{ group: MailGroup }>(
      await fetch(`/api/outlook/groups/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }),
    );
    setGroups((prev) => prev.map((g) => (g.id === id ? json.group : g)));
    return json.group;
  }, []);

  const remove = useCallback(async (id: string) => {
    await readJson(await fetch(`/api/outlook/groups/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  return { groups, loading, reload, create, update, remove };
}

/** Split pasted text ("a@x.in, Rohan <r@y.in>; b@z.in") into members. Bad addresses are returned apart. */
export function parseMemberText(text: string): {
  members: Array<{ email: string; name: string | null }>;
  invalid: string[];
} {
  const members: Array<{ email: string; name: string | null }> = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[,;\n]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const angle = part.match(/^(.*)<([^>]+)>$/);
    const email = (angle ? angle[2] : part).trim().toLowerCase();
    const name = angle ? angle[1].trim().replace(/^"|"$/g, '') || null : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid.push(part);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    members.push({ email, name });
  }
  return { members, invalid };
}

/** Members back to the editable text form, one per line. */
export function memberText(members: Array<{ email: string; name: string | null }>): string {
  return members.map((m) => (m.name ? `${m.name} <${m.email}>` : m.email)).join('\n');
}
