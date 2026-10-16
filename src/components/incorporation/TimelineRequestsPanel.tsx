"use client";

/**
 * Manager / admin side of the client portal's timeline change requests
 * (client portal v7, Home timeline editor "Request a timeline change"):
 * shows pending requests with the proposed dates and Approve / Decline.
 * Approve writes the dates into the engagement schedule.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { TimelineRequestDto } from "@/lib/client-home";
import { Surface } from "@/components/noir/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TimelineRequestsPanel({ engagementId, canDecide }: { engagementId: string; canDecide: boolean }) {
  const qc = useQueryClient();
  const key = ["timeline-requests", engagementId];
  const [note, setNote] = useState("");
  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/timeline-requests`);
      if (!res.ok) return [] as TimelineRequestDto[];
      return ((await res.json()) as { requests: TimelineRequestDto[] }).requests;
    },
  });
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "reject" }) => {
      const res = await fetch(
        `/api/engagements/${encodeURIComponent(engagementId)}/timeline-requests/${encodeURIComponent(id)}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, note: note.trim() || undefined }) },
      );
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save the decision");
      return decision;
    },
    onSuccess: (decision) => {
      toast.success(decision === "approve" ? "Timeline updated" : "Request declined");
      setNote("");
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["engagements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (list.data ?? []).filter((r) => r.status === "pending");
  if (pending.length === 0) return null;
  return (
    <Surface className="mb-4 border-amber-300 p-4">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Client asked for a timeline change</h3>
      {pending.map((r) => (
        <div key={r.id} className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {r.requestedByName ?? "Client"}: “{r.reason}”{r.slipDays ? ` · COI moves ${r.slipDays > 0 ? "+" : ""}${r.slipDays} days` : ""}
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {r.phases.map((p) => (
              <li key={p.id} className="font-mono text-xs">
                {p.name}: {p.from} → {p.to}
              </li>
            ))}
          </ul>
          {canDecide ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the client (optional)" />
              <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "approve" })}>
                Approve and update the timeline
              </Button>
              <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "reject" })}>
                Decline
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting for the project manager to decide.</p>
          )}
        </div>
      ))}
    </Surface>
  );
}
