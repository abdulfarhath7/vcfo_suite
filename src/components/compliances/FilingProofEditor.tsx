"use client";

/**
 * Staff side of the client portal's 📎 Proof chips and filing side panel
 * (client portal v7, rule 15): upload / remove proofs (acknowledgement,
 * challan, certificate) and set ARN, tax paid and the focus-track dates of
 * one filing. Shown in the staff Filings register next to the window control.
 *
 * Data: /api/client/compliances?id=, /[id]/proofs, /[id]/proofs/[proofId],
 * /[id]/details (repository `client-compliances.ts`; writes are staff-only).
 */
import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { toastSaved } from "@/components/ui/toast-saved";
import { Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Proof {
  id: string;
  fileName: string;
  kind: string;
  uploadedAt: string;
  legacy?: boolean;
}

interface Details {
  acknowledgementNo?: string | null;
  amountPaid?: string | null;
  dataReceivedOn?: string | null;
  preparingSince?: string | null;
  draftDueOn?: string | null;
  approvalDueOn?: string | null;
  approvedOn?: string | null;
}

const DATE_FIELDS: Array<[keyof Details, string]> = [
  ["dataReceivedOn", "Data received"],
  ["preparingSince", "Preparing since"],
  ["draftDueOn", "Draft due"],
  ["approvalDueOn", "Approval due"],
  ["approvedOn", "Approved on"],
];

export function FilingProofEditor({ instanceId, label }: { instanceId: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setOpen(true)} aria-label={`Proof and details · ${label}`}>
        <Paperclip className="h-3.5 w-3.5" aria-hidden />
        Proof
      </Button>
      {open ? <FilingProofEditorDialog instanceId={instanceId} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** The edit dialog on its own, for a caller that keeps its own trigger (the read dialog's Edit, the Proof pending chip). */
export function FilingProofEditorDialog({ instanceId, label, onClose }: { instanceId: string; label: string; onClose: () => void }) {
  const qc = useQueryClient();
  const base = `/api/client/compliances/${encodeURIComponent(instanceId)}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("acknowledgement");
  const fid = useId();
  const [draft, setDraft] = useState<Details | null>(null);

  const proofs = useQuery({
    queryKey: ["filing-proofs", instanceId],
    queryFn: async () => ((await (await fetch(`${base}/proofs`)).json()) as { proofs: Proof[] }).proofs ?? [],
  });
  const details = useQuery({
    queryKey: ["filing-details", instanceId],
    queryFn: async () => {
      const res = await fetch(`/api/client/compliances?id=${encodeURIComponent(instanceId)}`);
      const body = (await res.json()) as { filing?: Details; rows?: Details[] };
      return body.filing ?? body.rows?.[0] ?? {};
    },
  });
  const d: Details = draft ?? details.data ?? {};

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["filing-proofs", instanceId] });
    void qc.invalidateQueries({ queryKey: ["filings"] });
    void qc.invalidateQueries({ queryKey: ["client-compliances"] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const res = await fetch(`${base}/proofs`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
    },
    onSuccess: () => {
      toastSaved("Proof uploaded", { kind: "uploaded" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (proofId: string) => {
      const res = await fetch(`${base}/proofs/${encodeURIComponent(proofId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove the proof");
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, string | null> = {};
      for (const k of ["acknowledgementNo", "amountPaid", ...DATE_FIELDS.map(([f]) => f)] as Array<keyof Details>) {
        const v = d[k];
        patch[k] = v && String(v).trim() ? String(v).trim() : null;
      }
      const res = await fetch(`${base}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Could not save the details");
    },
    onSuccess: () => {
      toastSaved("Filing details saved");
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof Details, v: string) => setDraft({ ...d, [k]: v });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{label} · proof and details</DialogTitle>
        </DialogHeader>
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-ink-muted">Proofs (the client sees them)</h4>
          {(proofs.data ?? []).length === 0 ? <p className="text-sm text-ink-muted">No proof yet — the client sees “Proof pending” once filed.</p> : null}
          <ul className="divide-y divide-line rounded-md border border-line">
            {(proofs.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.fileName}</span>
                <span className="text-xs text-ink-muted">{p.kind}</span>
                {!p.legacy ? (
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)} disabled={remove.isPending}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <select className="h-9 rounded-md border border-line bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="acknowledgement">Acknowledgement</option>
              <option value="challan">Challan</option>
              <option value="certificate">Certificate</option>
              <option value="other">Other</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              Upload proof
            </Button>
          </div>
        </section>
        <section className="mt-4 grid grid-cols-2 gap-3">
          <label htmlFor={`${fid}-ack`} className="flex flex-col gap-1 text-xs font-medium">
            ARN / acknowledgement no.
            <Input id={`${fid}-ack`} value={d.acknowledgementNo ?? ""} onChange={(e) => set("acknowledgementNo", e.target.value)} />
          </label>
          <label htmlFor={`${fid}-paid`} className="flex flex-col gap-1 text-xs font-medium">
            Tax paid (₹)
            <Input id={`${fid}-paid`} inputMode="decimal" value={d.amountPaid ?? ""} onChange={(e) => set("amountPaid", e.target.value)} />
          </label>
          {DATE_FIELDS.map(([k, l]) => (
            <label key={k} htmlFor={`${fid}-${k}`} className="flex flex-col gap-1 text-xs font-medium">
              {l}
              <Input id={`${fid}-${k}`} type="date" value={(d[k] as string | null | undefined) ?? ""} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
        </section>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !draft}>
            Save details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
