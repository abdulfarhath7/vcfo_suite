"use client";

import { useReducer } from 'react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { AccentButton, Surface, EmptyStateIllustrated } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast-errors';
import { Send, Copy, CheckCircle2, Clock, Plus, FileInput } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { pressScale } from '@/lib/motion';

const statusMap = {
  pending: { label: 'Awaiting upload', cls: 'bg-warning-light text-warning-text', dot: 'bg-warning', icon: Clock },
  uploaded: { label: 'Submitted', cls: 'bg-info-light text-info-text', dot: 'bg-info', icon: Send },
  approved: { label: 'Approved', cls: 'bg-success-light text-success-text', dot: 'bg-success', icon: CheckCircle2 },
  rejected: { label: 'Needs revision', cls: 'bg-danger-light text-danger-text', dot: 'bg-danger', icon: Clock },
} as const;

type RequestsState = {
  open: boolean;
  inviteOpen: boolean;
  engId: string;
  label: string;
  message: string;
  email: string;
  inviteLink: string;
};

type RequestsAction = { type: 'patch'; patch: Partial<RequestsState> };

function requestsReducer(state: RequestsState, action: RequestsAction): RequestsState {
  return action.type === 'patch' ? { ...state, ...action.patch } : state;
}

export default function InternRequests() {
  const { requests, engagements, approveDoc, createRequest, inviteClient } = useApp();
  const [state, dispatch] = useReducer(requestsReducer, {
    open: false,
    inviteOpen: false,
    engId: engagements[0]?.id || '',
    label: '',
    message: '',
    email: '',
    inviteLink: '',
  });
  const { open, inviteOpen, engId, label, message, email, inviteLink } = state;
  const reduceMotion = useReducedMotion();

  const submit = () => {
    if (!engId || !label) return;
    createRequest({ engagementId: engId, taskId: `${engId}-custom`, label, message });
    toast.success('Document request sent to client');
    dispatch({ type: 'patch', patch: { open: false, label: '', message: '' } });
  };

  const sendInvite = () => {
    if (!engId || !email) return;
    const inv = inviteClient(engId, email);
    const link = `${window.location.origin}/invite/${inv.token}`;
    dispatch({ type: 'patch', patch: { inviteLink: link } });
    toast.success('Portal invite created — copy the link below');
  };

  return (
    <PageTransition>
      <SEO title="Document requests — VCFO Suite" description="Track what you have asked clients to upload and approve submissions." path="/app/intern/requests" />

      <PageHeader
        accent="role"
        icon={FileInput}
        eyebrow="Client collaboration"
        title="Document requests"
        subtitle={`${requests.length} sent to clients`}
        actions={
          <>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => dispatch({ type: 'patch', patch: { inviteOpen: true } })}>
              <Send className="w-3.5 h-3.5 mr-1.5" />Send portal invite
            </Button>
            <AccentButton size="sm" className="min-h-11" onClick={() => dispatch({ type: 'patch', patch: { open: true } })}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Request a document
            </AccentButton>
          </>
        }
      />

      <Surface className="overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_120px_120px_100px] gap-4 border-b border-border bg-table-header px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div>Document</div><div>Engagement</div><div>Due date</div><div>Status</div><div></div>
        </div>
        {requests.length === 0 && (
          <EmptyStateIllustrated
            icon={FileInput}
            title="No document requests yet"
            description="Ask a client to upload something and track it here — submissions appear with one-click approval."
            actionLabel="Request a document"
            onAction={() => dispatch({ type: 'patch', patch: { open: true } })}
            className="rounded-none border-0 bg-transparent"
          />
        )}
        {requests.map((r, i) => {
          const eng = engagements.find((e) => e.id === r.engagementId);
          const s = statusMap[r.status];
          return (
            <m.div
              key={r.id}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.03 * i }}
              whileTap={reduceMotion ? undefined : pressScale.whileTap}
              className="grid grid-cols-[1fr_180px_120px_120px_100px] gap-4 items-center border-b border-border px-4 py-3.5 last:border-0 hover:bg-raised/40 min-h-11 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[13px] text-ink truncate">{r.label}</div>
                {r.fileName && <div className="text-[11px] text-text-tertiary mt-0.5">{r.fileName}</div>}
              </div>
              <div className="text-[12px] text-text-secondary truncate">{eng?.companyName}</div>
              <div className="text-[12px] text-text-tertiary">{r.dueAt || '—'}</div>
              <span className={cn('inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[10.5px] font-medium w-fit', s.cls)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />{s.label}
              </span>
              <div className="justify-self-end">
                {r.status === 'uploaded' && (
                  <Button size="sm" variant="success" className="h-7 text-[11px]" onClick={() => { approveDoc(r.id); toast.success('Document approved'); }}>Approve</Button>
                )}
              </div>
            </m.div>
          );
        })}
      </Surface>

      {/* New request */}
      <Dialog open={open} onOpenChange={(v) => dispatch({ type: 'patch', patch: { open: v } })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[12px]">Engagement</Label>
              <Select value={engId} onValueChange={(v) => dispatch({ type: 'patch', patch: { engId: v } })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{engagements.map((e) => <SelectItem key={e.id} value={e.id}>{e.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Document name</Label>
              <Input value={label} onChange={(e) => dispatch({ type: 'patch', patch: { label: e.target.value } })} placeholder="e.g. Board resolution for bank account opening" className="mt-1.5" />
            </div>
            <div>
              <Label className="text-[12px]">Note for the client (optional)</Label>
              <Textarea value={message} onChange={(e) => dispatch({ type: 'patch', patch: { message: e.target.value } })} className="mt-1.5" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => dispatch({ type: 'patch', patch: { open: false } })}>Cancel</Button>
            <Button onClick={submit} disabled={!label}>Send to client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite */}
      <Dialog open={inviteOpen} onOpenChange={(v) => dispatch({ type: 'patch', patch: { inviteOpen: v, inviteLink: v ? inviteLink : '' } })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send portal invite</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[12px]">Engagement</Label>
              <Select value={engId} onValueChange={(v) => dispatch({ type: 'patch', patch: { engId: v } })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{engagements.map((e) => <SelectItem key={e.id} value={e.id}>{e.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Client email address</Label>
              <Input type="email" value={email} onChange={(e) => dispatch({ type: 'patch', patch: { email: e.target.value } })} placeholder="founder@company.in" className="mt-1.5" />
            </div>
            {inviteLink && (
              <div className="p-3 rounded-md bg-success-light/50 border border-border">
                <div className="text-[11.5px] text-success-text font-medium mb-2">
                  Portal link (share with the client — email send is not wired yet)
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] bg-surface px-2 py-1.5 rounded border border-border truncate">{inviteLink}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copied'); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => dispatch({ type: 'patch', patch: { inviteOpen: false } })}>Close</Button>
            <Button onClick={sendInvite} disabled={!email}>Create invite link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
