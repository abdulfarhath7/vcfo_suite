"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { m } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SEO } from '@/components/SEO';
import { Mail, Shield, ArrowRight } from 'lucide-react';
import { AccentButton, GoldDivider, GrainOverlay, Eyebrow, Mono, TrustBadge } from '@/components/noir';
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
    if (u) router.push('/app/client/inbox');
  };

  if (!inv || !eng) {
    return (
      <div className="public-lockup-theme min-h-screen grid place-items-center bg-blue-50/40 p-6" data-role="client">
        <SEO title="Invite unavailable — VCFO Suite" description="This client portal invite is invalid or has expired." path={`/invite/${token}`} />
        <GrainOverlay className="fixed inset-0 pointer-events-none opacity-30" />
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="surface relative z-10 max-w-sm p-8 text-center"
        >
          <Eyebrow>Invite</Eyebrow>
          <h1 className="display-md text-foreground mt-1">Invite unavailable</h1>
          <GoldDivider className="mx-auto my-5 max-w-[48px]" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            This link is invalid or has expired. Ask your project team for a new client portal invite.
          </p>
          <AccentButton type="button" size="lg" className="mt-6 w-full min-h-11" onClick={() => router.push('/login')}>
            Back to sign in
            <ArrowRight className="w-4 h-4" />
          </AccentButton>
        </m.div>
      </div>
    );
  }

  return (
    <div className="public-lockup-theme min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-blue-50/40" data-role="client">
      <SEO title={`Join ${eng.companyName} — VCFO Suite`} description="Accept your invite to the VCFO Suite client portal." path={`/invite/${token}`} />

      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-700 to-blue-800 text-white p-12 overflow-hidden">
        <GrainOverlay className="opacity-10" />
        <div className="relative z-10">
          <SbcLogo variant="lockup" size={36} surface="dark" decorative />
        </div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
          className="relative z-10 max-w-md"
        >
          <Eyebrow className="mb-4 text-blue-100">You&apos;re invited</Eyebrow>
          <h1 className="display-lg text-white">
            Join <em className="italic text-blue-200">{eng.companyName}</em>
          </h1>
          <GoldDivider className="my-6 max-w-[60px] opacity-60" />
          <p className="text-sm text-blue-50/90 leading-relaxed prose-narrow">
            Upload documents, respond to requests, and follow incorporation progress — all in one secure workspace shared with your engagement team.
          </p>
          <TrustBadge className="mt-5">Encrypted · read-only progress board</TrustBadge>
        </m.div>

        <div className="relative z-10 flex items-center gap-4 text-[11px] text-blue-100/70">
          <Mono>Document vault</Mono>
          <span className="h-1 w-1 rounded-full bg-blue-300/50" />
          <Mono>Action inbox</Mono>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 lg:p-12">
        <GrainOverlay className="fixed inset-0 pointer-events-none opacity-20 lg:hidden" />
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="surface relative z-10 w-full max-w-[420px] p-8"
        >
          <div className="mb-6 lg:hidden">
            <SbcLogo variant="lockup" size={28} decorative />
          </div>

          <Eyebrow>Client portal</Eyebrow>
          <h2 className="display-md text-foreground mt-1">Complete your profile</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Join <span className="font-medium text-foreground">{eng.companyName}</span> to collaborate with your engagement team.
          </p>
          <GoldDivider className="my-6 max-w-[48px]" />

          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/80 p-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="text-[12px]">
              <div className="font-medium text-foreground">{inv.email}</div>
              <div className="text-muted-foreground">Sent by your project team</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-[11.5px] text-muted-foreground">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-11 text-[13px] bg-background border-input focus-visible:ring-ring"
                autoFocus
                placeholder="e.g. Sarah Chen"
                required
              />
            </div>
            <AccentButton
              type="submit"
              size="lg"
              className="w-full min-h-11 bg-success text-success-foreground hover:bg-success/90 hover:brightness-100 active:brightness-95"
              disabled={!name.trim()}
            >
              <Shield className="w-3.5 h-3.5" />
              Join workspace
              <ArrowRight className="w-4 h-4" />
            </AccentButton>
          </form>
        </m.div>
      </div>
    </div>
  );
}
