"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { m } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { Mail, Shield, ArrowRight } from 'lucide-react';
import { Eyebrow, Mono, TrustBadge } from '@/components/noir';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { ease } from '@/lib/motion';

export default function InviteAccept() {
  const params = useParams();
  const token = (params.token as string) ?? '';
  const { invites, engagements, acceptInvite } = useApp();
  const router = useRouter();
  const inv = invites.find((i) => i.token === token);
  const eng = inv ? engagements.find((e) => e.id === inv.engagementId) : null;
  const [name, setName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const u = acceptInvite(token, name);
    if (u) router.push('/app/client/overview');
  };

  if (!inv || !eng) {
    return (
      <div className="public-lockup-theme min-h-screen grid place-items-center bg-surface p-6" data-role="client">
        <SEO title="Invite unavailable — VCFO Suite" description="This client portal invite is invalid or has expired." path={`/invite/${token}`} />
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="relative z-10 max-w-sm rounded-lg border border-line bg-surface-raised p-8 text-center shadow-card"
        >
          <Eyebrow>Invite</Eyebrow>
          <h1 className="display-md text-ink mt-1">Invite unavailable</h1>
          <div className="mx-auto my-5 h-px w-12 bg-brand" aria-hidden />
          <p className="text-[13px] text-ink-muted leading-relaxed">
            This link is invalid or has expired. Ask your project team for a new client portal invite.
          </p>
          <Button type="button" size="lg" className="mt-6 w-full" onClick={() => router.push('/login')}>
            Back to sign in
            <ArrowRight className="w-4 h-4" />
          </Button>
        </m.div>
      </div>
    );
  }

  return (
    <div className="public-lockup-theme min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-surface" data-role="client">
      <SEO title={`Join ${eng.companyName} — VCFO Suite`} description="Accept your invite to the VCFO Suite client portal." path={`/invite/${token}`} />

      {/* Navy side panel: `side` is the one fixed-dark surface, so the copy stays light in both themes. */}
      <div className="relative hidden lg:flex flex-col justify-between bg-side text-side-ink p-12 overflow-hidden">
        <div className="relative z-10">
          <SbcLogo variant="lockup" size={36} surface="dark" decorative />
        </div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
          className="relative z-10 max-w-md"
        >
          <Eyebrow className="mb-4 text-side-muted">You&apos;re invited</Eyebrow>
          <h1 className="display-lg text-side-ink">
            Join <em className="italic text-side-muted">{eng.companyName}</em>
          </h1>
          <div className="my-6 h-px w-[60px] bg-side-muted" aria-hidden />
          <p className="text-sm text-side-muted leading-relaxed prose-narrow">
            Upload documents, respond to requests, and follow incorporation progress — all in one secure workspace shared with your engagement team.
          </p>
          <TrustBadge className="mt-5">Encrypted · read-only progress board</TrustBadge>
        </m.div>

        <div className="relative z-10 flex items-center gap-4 text-[11px] text-side-muted">
          <Mono>Document vault</Mono>
          <span className="h-1 w-1 bg-side-muted" aria-hidden />
          <Mono>Action inbox</Mono>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 lg:p-12">
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="relative z-10 w-full max-w-[420px] rounded-lg border border-line bg-surface-raised p-8 shadow-card"
        >
          <div className="mb-6 lg:hidden">
            <SbcLogo variant="lockup" size={28} decorative />
          </div>

          <Eyebrow>Client portal</Eyebrow>
          <h2 className="display-md text-ink mt-1">Complete your profile</h2>
          <p className="mt-2 text-[13px] text-ink-muted">
            Join <span className="font-medium text-ink">{eng.companyName}</span> to collaborate with your engagement team.
          </p>
          <div className="my-6 h-px w-12 bg-brand" aria-hidden />

          <div className="mb-6 flex items-start gap-2.5 rounded-md border border-line bg-brand-soft p-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="text-[12px]">
              <div className="font-medium text-ink">{inv.email}</div>
              <div className="text-ink-muted">Sent by your project team</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-[11.5px] text-ink-muted">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-control-lg text-[13px] bg-surface-sunken border-line-strong focus-visible:ring-focus-ring"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
                autoFocus
                placeholder="e.g. Sarah Chen"
                required
              />
            </div>
            <Button type="submit" variant="success" size="lg" className="w-full" disabled={!name.trim()}>
              <Shield className="w-3.5 h-3.5" />
              Join workspace
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </m.div>
      </div>
    </div>
  );
}
