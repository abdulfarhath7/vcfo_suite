"use client";

/**
 * Staff editor for the client portal's Home › "What SBC is doing" card
 * (client portal v7): work items with % done and a ready date. Without items
 * the card falls back to the steps SBC currently holds.
 *
 * Data: GET / POST /api/client/home/work-items (repository `client-home.ts`;
 * writes are staff-only).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Surface } from "@/components/noir/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Item {
  id: string;
  title: string;
  progressPct: number;
  readyOn?: string;
  status: string;
}

export function WorkItemsPanel({ engagementId }: { engagementId: string }) {
  const qc = useQueryClient();
  const key = ["work-items", engagementId];
  const [title, setTitle] = useState("");
  const [readyOn, setReadyOn] = useState("");
  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/client/home/work-items?engagementId=${encodeURIComponent(engagementId)}`);
      if (!res.ok) return [] as Item[];
      return ((await res.json()) as { items: Item[] }).items;
    },
  });
  const save = useMutation({
    mutationFn: async (body: Partial<Item> & { title: string }) => {
      const res = await fetch("/api/client/home/work-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ engagementId, ...body, readyOn: body.readyOn || undefined }),
      });
      if (!res.ok) throw new Error("Could not save");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  const items = list.data ?? [];
  return (
    <Surface className="mt-4 p-4">
      <h3 className="mb-1 text-sm font-semibold text-foreground">What SBC is doing (client Home)</h3>
      <p className="mb-3 text-xs text-muted-foreground">The client sees these with % done. Without any, Home lists the steps SBC holds.</p>
      {items.length ? (
        <ul className="mb-3 divide-y divide-border rounded-md border border-border">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className={`min-w-0 flex-1 truncate ${it.status === "done" ? "text-muted-foreground line-through" : ""}`}>{it.title}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                defaultValue={it.progressPct}
                aria-label={`${it.title} · % done`}
                onMouseUp={(e) => save.mutate({ ...it, progressPct: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={(e) => save.mutate({ ...it, progressPct: Number((e.target as HTMLInputElement).value) })}
              />
              <span className="w-10 text-right font-mono text-xs">{it.progressPct}%</span>
              <span className="w-24 font-mono text-xs text-muted-foreground">{it.readyOn ?? "—"}</span>
              <Button size="sm" variant="ghost" onClick={() => save.mutate({ ...it, status: it.status === "done" ? "active" : "done" })}>
                {it.status === "done" ? "Reopen" : "Done"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => save.mutate({ ...it, status: "hidden" })}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          save.mutate({ title: title.trim(), readyOn, progressPct: 0 });
          setTitle("");
          setReadyOn("");
        }}
      >
        <Input className="min-w-[14rem] flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Drafting MOA & AOA" />
        <Input className="w-40" type="date" value={readyOn} onChange={(e) => setReadyOn(e.target.value)} aria-label="Ready on" />
        <Button type="submit" size="sm" disabled={!title.trim() || save.isPending}>
          Add
        </Button>
      </form>
    </Surface>
  );
}
