"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, Users, UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { SEO } from "@/components/SEO";
import { EmptyStateIllustrated } from "@/components/noir";
import { Button } from "@/components/ui/button";
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
      <PageHeader
        accent="violet"
        icon={Users}
        title="Project team"
        subtitle={
          engagement
            ? `Collaborators for ${engagement.companyName}. Invite someone new, or substitute an existing client with another person.`
            : "No project linked to your account yet."
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border/70 bg-panel p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-role" aria-hidden />
            Clients on this project
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : members.length === 0 ? (
            <EmptyStateIllustrated
              icon={Users}
              title="No client members yet"
              description="Invite a colleague to give them access to this project."
              className="py-8"
            />
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                      {m.memberRole === "owner" ? "Primary" : "Member"}
                      {m.userId === user?.id ? " · you" : ""}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => openSubstitute(m)}
                      disabled={!engagement}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
                      Substitute
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Substitute replaces that person on this project only. If they were Primary, the new
            person becomes Primary. Substituting yourself removes your access.
          </p>
        </section>

        <section className="rounded-xl border border-border/70 bg-panel p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserPlus className="h-4 w-4 text-role" aria-hidden />
            Invite another client
          </div>
          <form className="space-y-3" onSubmit={invite}>
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
              <p className="text-[11px] text-muted-foreground">
                Sent in their welcome email when this is a new account. Ask them to change it after
                first login.
              </p>
            </div>
            <Button type="submit" disabled={!engagement || submitting} className="w-full">
              {submitting ? "Adding…" : "Add client to project"}
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
              {replacingSelf ? "Substitute yourself" : "Substitute client"}
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
              <p className="text-[11px] text-muted-foreground">
                Used only when creating a new account. Existing client accounts keep their password.
              </p>
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
                {substituting ? "Substituting…" : replacingSelf ? "Hand off & leave" : "Substitute"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
