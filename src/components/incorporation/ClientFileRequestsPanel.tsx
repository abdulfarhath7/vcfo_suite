"use client";

/**
 * Staff side of client file requests (client portal v7): on a step page, the
 * firm asks the client for one file field ("NOC from property owner"), with a
 * note and a due date. The client sees it as a drop zone on their step page,
 * and "Approve & submit" stays blocked until it is uploaded.
 *
 * Data: GET / POST /api/engagements/[id]/file-requests,
 *       DELETE /api/engagements/[id]/file-requests/[requestId]
 * (repository `client-incorporation.ts`, staff-only writes).
 */
import { useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { ChecklistItem } from "@/data/checklist";
import type { ClientFileRequestDto } from "@/lib/client-portal/incorporation-types";
import { Surface } from "@/components/noir/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClientFileRequestsPanel({ engagementId, item }: { engagementId: string; item: ChecklistItem }) {
  const qc = useQueryClient();
  const key = ["file-requests", engagementId];
  const fileFields = useMemo(() => (item.fields ?? []).filter((f) => f.type === "file"), [item]);
  const [fieldId, setFieldId] = useState(fileFields[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const fid = useId();
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");

  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/file-requests`);
      if (!res.ok) throw new Error("Could not load file requests");
      return ((await res.json()) as { requests: ClientFileRequestDto[] }).requests;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const field = fileFields.find((f) => f.id === fieldId);
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/file-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stepId: item.id,
          fieldId,
          label: label.trim() || field?.label || "File",
          note: note.trim() || undefined,
          dueDate: dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not send the request");
    },
    onSuccess: () => {
      toast.success("Request sent to the client");
      setLabel("");
      setNote("");
      setDueDate("");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(
        `/api/engagements/${encodeURIComponent(engagementId)}/file-requests/${encodeURIComponent(requestId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Could not cancel the request");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (fileFields.length === 0) return null;
  const mine = (list.data ?? []).filter((r) => r.stepId === item.id);

  return (
    <Surface className="mt-5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Request files from the client</h3>
        <span className="text-xs text-ink-muted">Shown on the client&apos;s step page; approval waits for them</span>
      </div>
      {mine.length > 0 ? (
        <ul className="mb-4 divide-y divide-line rounded-md border border-line">
          {mine.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{r.label}</span>
                {r.dueDate ? <span className="text-ink-muted"> · due {r.dueDate}</span> : null}
              </span>
              {r.fulfilledAt ? (
                <span className="text-xs font-semibold text-positive">Uploaded{r.fileName ? ` · ${r.fileName}` : ""}</span>
              ) : (
                <>
                  <span className="text-xs font-semibold text-warning">Waiting on client</span>
                  <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>
                    Cancel
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!fieldId) return;
          create.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          File
          <select
            className="h-9 rounded-md border border-line bg-background px-2 text-sm"
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
          >
            {fileFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${fid}-label`} className="flex flex-col gap-1 text-xs font-medium text-ink">
          Name the client sees
          <Input id={`${fid}-label`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={fileFields.find((f) => f.id === fieldId)?.label} />
        </label>
        <label htmlFor={`${fid}-due`} className="flex flex-col gap-1 text-xs font-medium text-ink">
          Due
          <Input id={`${fid}-due`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <Button type="submit" disabled={create.isPending || !fieldId}>
          Request
        </Button>
        <label htmlFor={`${fid}-note`} className="flex flex-col gap-1 text-xs font-medium text-ink sm:col-span-4">
          Note (optional)
          <Input id={`${fid}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Max 2 months old" />
        </label>
      </form>
    </Surface>
  );
}
