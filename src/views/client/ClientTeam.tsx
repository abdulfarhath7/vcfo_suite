"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, ChevronLeft, Mail, UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useClientOverview } from "@/lib/use-client-overview";
import { initialsFromName } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toastEmailDispatch, toastError, toastSuccess, errorMessage } from "@/lib/toast-errors";
import type { EmailDispatchResult } from "@/lib/email/email-dispatch";
import { DEFAULT_CLIENT_TEMP_PASSWORD } from "@/lib/api/schemas";

type ClientMember = {
  userId: string;
  email: string;
  name: string;
  memberRole: "owner" | "member";
  createdAt: string;
};

export default function ClientTeamPage() {
  const { engagements, user, signOut } = useApp();
  const engagement = engagements[0];
  const { data: overviewData } = useClientOverview();
  const firmTeam = overviewData?.overview?.team ?? [];
  const [members, setMembers] = useState<ClientMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState(DEFAULT_CLIENT_TEMP_PASSWORD);

  const [substituteTarget, setSubstituteTarget] = useState<ClientMember | null>(null);
  const [subEmail, setSubEmail] = useState("");
  const [subName, setSubName] = useState("");
  const [subPassword, setSubPassword] = useState(DEFAULT_CLIENT_TEMP_PASSWORD);
  const [substituting, setSubstituting] = useState(false);

  const load = useCallback(async () => {
    if (!engagement?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/engagements/${engagement.id}/clients`);
      const data = (await res.json()) as { clients?: ClientMember[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load team");
      setMembers(data.clients ?? []);
    } catch (err) {
      toastError("Could not load team", errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [engagement?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSubstitute = (member: ClientMember) => {
    setSubstituteTarget(member);
    setSubEmail("");
    setSubName("");
    setSubPassword(DEFAULT_CLIENT_TEMP_PASSWORD);
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagement?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/engagements/${engagement.id}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim() || undefined,
          password,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        clients?: ClientMember[];
        email?: EmailDispatchResult;
        invited?: { email: string; createdNewUser: boolean };
      };
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setMembers(data.clients ?? []);
      toastSuccess(
        "Client added",
        data.invited?.createdNewUser
          ? `${data.invited.email} can sign in with the temporary password.`
          : `${data.invited?.email ?? email} now has access to this project.`,
      );
      toastEmailDispatch(data.email, {
        engagementId: engagement.id,
        companyName: engagement.companyName,
      });
      setEmail("");
      setFullName("");
      setPassword(DEFAULT_CLIENT_TEMP_PASSWORD);
    } catch (err) {
      toastError("Could not add client", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const substitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagement?.id || !substituteTarget) return;
    setSubstituting(true);
    try {
      const res = await fetch(`/api/engagements/${engagement.id}/clients/substitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replaceUserId: substituteTarget.userId,
          email: subEmail.trim(),
          fullName: subName.trim() || undefined,
          password: subPassword,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        clients?: ClientMember[];
        email?: EmailDispatchResult;
        substituted?: {
          email: string;
          name: string;
          createdNewUser: boolean;
          actorLostAccess: boolean;
          replacedName: string;
        };
      };
      if (!res.ok) throw new Error(data.error ?? "Substitute failed");

      toastSuccess(
        "Client substituted",
        data.substituted?.createdNewUser
          ? `${data.substituted.email} replaces ${data.substituted.replacedName} and can sign in with the temporary password.`
          : `${data.substituted?.email ?? subEmail} now replaces ${data.substituted?.replacedName ?? substituteTarget.name} on this project.`,
      );
      toastEmailDispatch(data.email, {
        engagementId: engagement.id,
        companyName: engagement.companyName,
      });

      if (data.substituted?.actorLostAccess) {
        setSubstituteTarget(null);
        toastSuccess(
          "You left this project",
          "Your access was handed to the new client. Sign in again with that account if you need portal access.",
        );
        await signOut();
        return;
      }

      setMembers(data.clients ?? []);
      setSubstituteTarget(null);
    } catch (err) {
      toastError("Could not substitute client", errorMessage(err));
    } finally {
      setSubstituting(false);
    }
  };

  const replacingSelf = substituteTarget?.userId === user?.id;

  return (
    <PageTransition>
      <SEO
        title="Team — Client portal"
        description="Invite or substitute clients on this project."
        path="/app/client/team"
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/app/client/overview"
            className="-ml-1.5 inline-flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-[13px] font-medium text-muted-foreground hover:bg-primary-light hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Back to home
          </Link>
          <h1 className="min-w-0 truncate text-[20px] font-semibold tracking-tight text-foreground">
            Project team
          </h1>
        </div>
        <p className="truncate text-[13px] text-muted-foreground">
          {engagement ? engagement.companyName : "No project linked to your account yet."}
        </p>
      </div>

      <div className="border border-border bg-panel">
        <section>
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-semibold text-foreground">Your VCFO team</h2>
            <p className="text-[12px] text-muted-foreground">Working on your engagement</p>
          </div>
          {firmTeam.length === 0 ? (
            <p className="px-5 py-3 text-[13px] text-muted-foreground">
              Your project manager and project lead are being assigned.
            </p>
          ) : (
            <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {firmTeam.map((member) => (
                <li key={member.id} className="flex min-w-0 items-center gap-3 px-5 py-3">
                  <Initials name={member.name} tone="firm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-foreground">{member.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{member.role}</p>
                  </div>
                  {member.email ? (
                    <a
                      href={`mailto:${member.email}`}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:bg-muted"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      Email
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-border">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-semibold text-foreground">People from your company</h2>
            <p className="text-[12px] tabular-nums text-muted-foreground">
              {loading ? "" : `${members.length} with access`}
            </p>
          </div>
          {loading ? (
            <p className="px-5 py-3 text-[13px] text-muted-foreground">Loading…</p>
          ) : members.length === 0 ? (
            <p className="px-5 py-3 text-[13px] text-muted-foreground">No one has access yet. Add someone below.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <Initials name={m.name} tone="client" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-foreground">
                      {m.name}
                      {m.userId === user?.id ? (
                        <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">{m.email}</p>
                  </div>
                  <span
                    className={
                      m.memberRole === "owner"
                        ? "rounded-sm bg-primary-light px-1.5 py-px text-[11px] font-semibold text-primary"
                        : "rounded-sm bg-muted px-1.5 py-px text-[11px] font-semibold text-muted-foreground"
                    }
                  >
                    {m.memberRole === "owner" ? "Primary contact" : "Member"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-[12px]"
                    onClick={() => openSubstitute(m)}
                    disabled={!engagement}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
                    Replace
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-border bg-muted/30 px-5 py-4">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
            <UserPlus className="h-4 w-4 text-primary" aria-hidden />
            Give someone else access
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            They get an email with a sign-in link and this temporary password.
          </p>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_1fr_auto] lg:items-end"
            onSubmit={invite}
          >
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Temporary password</Label>
              <Input
                id="invite-password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!engagement || submitting} className="sm:col-span-2 lg:col-span-1">
              {submitting ? "Adding…" : "Add to project"}
            </Button>
          </form>
        </section>
      </div>

      <Dialog
        open={Boolean(substituteTarget)}
        onOpenChange={(open) => {
          if (!open) setSubstituteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {replacingSelf ? "Replace yourself" : "Replace this person"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Replace{" "}
            <span className="font-medium text-foreground">
              {substituteTarget?.name} ({substituteTarget?.email})
            </span>{" "}
            with someone else on{" "}
            <span className="font-medium text-foreground">{engagement?.companyName}</span>.
            {replacingSelf
              ? " You will lose access to this project after the handoff."
              : null}
          </p>
          <form className="space-y-3" onSubmit={substitute}>
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">Replacement name</Label>
              <Input
                id="sub-name"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-email">Replacement email</Label>
              <Input
                id="sub-email"
                type="email"
                required
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                placeholder="new.person@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-password">Temporary password</Label>
              <Input
                id="sub-password"
                type="text"
                required
                minLength={8}
                value={subPassword}
                onChange={(e) => setSubPassword(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSubstituteTarget(null)}
                disabled={substituting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={substituting}>
                {substituting ? "Replacing…" : replacingSelf ? "Hand off & leave" : "Replace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

function Initials({ name, tone }: { name: string; tone: "firm" | "client" }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
        tone === "firm"
          ? "bg-primary-light text-primary-dark"
          : "bg-[oklch(var(--phase-post-soft))] text-[oklch(var(--phase-post-text))]",
      )}
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  );
}
