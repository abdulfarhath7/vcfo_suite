'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { ChangeConfirm } from '@/components/ui/inline-confirm';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/spectrum-chip';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/context/AppContext';
import { useAgentSettingsPage, useSaveAgentSetting } from '@/hooks/use-agent-runs';
import { isFirmWideAdmin } from '@/lib/auth';
import { roleAppSegment } from '@/lib/auth-routes';
import { pilotSummary, settingValueText, type AgentSettingsResponse, type AgentStaffOption } from '@/lib/card-agents/settings-page';
import type { AgentRouteSetting, AgentSettingKey } from '@/lib/card-agents/settings';
import { toastError, toastSuccess } from '@/lib/toast-errors';

/**
 * SETTINGS > AGENTS (docs/specs/live-portal-browser/MASTER-PLAN.md screen 10), admin and super
 * admin only. The kill switch; the two routes (GSTZen API and the live browser), each with
 * whether this deployment is configured for it, the live switch and the pilot users; the portal
 * packs with their legal status (read only: live use needs the CS opinion); the limits; and the
 * recipes with the patch proposals waiting. Every change asks first in place (`ChangeConfirm`)
 * and the server writes an audit event for it (`setAgentSetting`). Everything starts off.
 */

interface Pending {
  key: AgentSettingKey;
  value: unknown;
  question: string;
}

const ROUTES: Array<{ key: 'gstzen' | 'browser'; title: string; what: string }> = [
  { key: 'gstzen', title: 'GSTZen API', what: 'GST returns, notices and GSTIN checks through the GSP, with the taxpayer’s consent OTP.' },
  { key: 'browser', title: 'Live browser', what: 'MCA and registration forms in a browser on SBC’s server. Each portal also needs its pack to be live.' },
];

const SETTING_LABEL: Record<AgentSettingKey, string> = {
  killSwitch: 'the kill switch',
  gstzen: 'the GSTZen API route',
  browser: 'the live browser route',
  browserHoursCap: 'the browser hours cap',
  idleMinutes: 'the idle stop',
  maxMinutes: 'the hard stop',
  onePerLogin: 'one run per portal login',
};

function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft px-4 py-3 first:border-t-0 md:px-5">
      <span className="min-w-0 flex-1 basis-[260px]">
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        {hint ? <span className="mt-0.5 block text-[12.5px] text-ink-muted">{hint}</span> : null}
      </span>
      <span className="flex flex-none flex-wrap items-center gap-2">{children}</span>
    </div>
  );
}

function PilotPicker({
  staff,
  value,
  disabled,
  onSave,
  onCancel,
}: {
  staff: AgentStaffOption[];
  value: AgentRouteSetting;
  disabled: boolean;
  onSave: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const [ids, setIds] = useState<string[]>(value.pilotUserIds);
  const [q, setQ] = useState('');
  const shown = staff.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="grid gap-2 border-t border-line-soft bg-surface-sunken px-4 py-3 md:px-5">
      <p className="text-[12.5px] text-ink-muted">Pick the staff who may use this route while it is in pilot. Nobody picked means every staff member.</p>
      <Input type="search" aria-label="Find a person" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} className="h-control-sm max-w-[280px] text-[13px]" />
      <div className="grid max-h-48 grid-cols-1 gap-x-4 overflow-y-auto sm:grid-cols-2">
        {shown.map((s) => (
          <label key={s.id} className="flex items-center gap-2 py-0.5 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={ids.includes(s.id)}
              onChange={(e) => setIds((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
            />
            <span className="truncate">{s.name}</span>
            <span className="text-[11.5px] text-ink-muted">{s.role === 'intern' ? 'lead' : s.role.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
      <span className="flex gap-2">
        <Button size="sm" disabled={disabled} onClick={() => onSave(ids)}>
          {ids.length ? `Use these ${ids.length}` : 'Use all staff'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </span>
    </div>
  );
}

function NumberSetting({
  label,
  hint,
  unit,
  value,
  min,
  max,
  disabled,
  onAsk,
}: {
  label: string;
  hint: ReactNode;
  unit: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onAsk: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const n = Number(draft);
  const valid = draft.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
  return (
    <Row title={label} hint={hint}>
      <label className="flex items-center gap-1.5 text-[13px] text-ink-muted">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          aria-label={label}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          className="h-control-sm w-[84px] text-right text-[13px] tabular-nums"
        />
        {unit}
      </label>
      <Button size="sm" variant="outline" disabled={disabled || !valid || n === value} onClick={() => onAsk(n)}>
        Change
      </Button>
    </Row>
  );
}

export function AgentSettingsBody({ data }: { data: AgentSettingsResponse }) {
  const { user } = useApp();
  const save = useSaveAgentSetting();
  const [pending, setPending] = useState<Pending | null>(null);
  const [picking, setPicking] = useState<'gstzen' | 'browser' | null>(null);
  const { settings, deployment, packs, canEdit, admin } = data;
  const staff = admin?.staff ?? [];
  const seg = roleAppSegment(user?.role);

  const ask = (key: AgentSettingKey, value: unknown) =>
    setPending({ key, value, question: `Change ${SETTING_LABEL[key]}?` });
  const confirm = () => {
    if (!pending) return;
    save.mutate(
      { key: pending.key, value: pending.value },
      {
        onSuccess: () => {
          toastSuccess('Agent setting saved', 'The change is in the audit log under your name.');
          setPending(null);
          setPicking(null);
        },
        onError: (err) =>
          toastError('Could not save the setting', err.message === 'not_configured' ? 'This deployment is not configured for that route.' : err.message),
      },
    );
  };
  const confirmRow = (keys: AgentSettingKey[]) =>
    pending && keys.includes(pending.key) ? (
      <ChangeConfirm
        question={pending.question}
        now={settingValueText(pending.key, settings[pending.key], staff)}
        after={settingValueText(pending.key, pending.value, staff)}
        confirm="Save"
        busy={save.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    ) : null;

  const used = admin?.browserHoursUsed ?? 0;
  const cap = settings.browserHoursCap;

  return (
    <div className="flex flex-col gap-5">
      {!canEdit ? (
        <p role="status" className="rounded-md bg-info-soft px-3 py-2 text-[13px] text-info">
          {user?.role && isFirmWideAdmin(user.role) ? 'Demo logins cannot change agent settings.' : 'Only an admin can change agent settings.'}
        </p>
      ) : null}

      <DashSection title="Kill switch" flush>
        <Row
          title="Stop every agent"
          hint="On stops every card agent at once: no new live session, no new API call, and open sessions end."
        >
          <Chip raw tone={settings.killSwitch ? 'bad' : 'idle'}>
            {settings.killSwitch ? 'On' : 'Off'}
          </Chip>
          <Switch
            aria-label="Kill switch"
            checked={settings.killSwitch}
            disabled={!canEdit}
            onCheckedChange={(on) => ask('killSwitch', on)}
          />
        </Row>
        {confirmRow(['killSwitch'])}
      </DashSection>

      <DashSection title="Routes" flush>
        {ROUTES.map((r) => {
          const value = settings[r.key];
          const configured = deployment[r.key];
          return (
            <div key={r.key}>
              <Row
                title={r.title}
                hint={
                  <>
                    {r.what}
                    <span className="mt-1 block">
                      {configured ? (
                        <Chip raw tone="ok">
                          Configured
                        </Chip>
                      ) : (
                        <Chip raw tone="idle">
                          Not configured on this deployment
                        </Chip>
                      )}
                      <span className="ml-2">Pilot users: {pilotSummary(value, staff)}</span>
                    </span>
                  </>
                }
              >
                <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setPicking(picking === r.key ? null : r.key)}>
                  Pilot users
                </Button>
                <span className="flex items-center gap-2 text-[13px] text-ink-muted">
                  Live
                  <Switch
                    aria-label={`${r.title} live`}
                    checked={value.live}
                    disabled={!canEdit || (!configured && !value.live)}
                    onCheckedChange={(on) => ask(r.key, { ...value, live: on })}
                  />
                </span>
              </Row>
              {picking === r.key ? (
                <PilotPicker
                  key={value.pilotUserIds.join(',')}
                  staff={staff}
                  value={value}
                  disabled={!canEdit}
                  onCancel={() => setPicking(null)}
                  onSave={(ids) => ask(r.key, { ...value, pilotUserIds: ids })}
                />
              ) : null}
              {confirmRow([r.key])}
            </div>
          );
        })}
      </DashSection>

      <DashSection title="Portal packs" meta={packs.length} flush>
        <p className="border-b border-line-soft px-4 py-2.5 text-[12.5px] text-ink-muted md:px-5">
          Read only. A pack runs on its live portal only when its legal status is CS cleared and the deployment lists it in
          ASSIST_LIVE_PACKS. Live use on a government portal needs the CS opinion first.
        </p>
        <ul>
          {packs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft px-4 py-2.5 first:border-t-0 md:px-5">
              <span className="min-w-0 flex-1 basis-[260px]">
                <span className="block truncate text-[13.5px] text-ink">{p.title}</span>
                <span className="block truncate font-mono text-[11.5px] text-ink-muted">{p.hosts.join(', ')}</span>
              </span>
              <Chip raw tone={p.legalStatus === 'cs-cleared' ? 'ok' : 'idle'} className="min-w-[104px]">
                {p.legalStatus === 'cs-cleared' ? 'CS cleared' : 'Mock only'}
              </Chip>
              <Chip raw tone={p.live ? 'prog' : 'idle'} className="min-w-[84px]">
                {p.live ? 'Live' : 'Not live'}
              </Chip>
            </li>
          ))}
        </ul>
      </DashSection>

      <DashSection title="Limits" flush>
        <div className="grid gap-1.5 px-4 py-3 md:px-5">
          <span className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
            <span className="font-medium text-ink">Live browser hours this month</span>
            <span className="tabular-nums text-ink-2">
              {used} / {cap} h{admin ? <span className="ml-1 text-ink-muted">· {admin.browserSessions} sessions</span> : null}
            </span>
          </span>
          <ProgressBar value={cap > 0 ? (used / cap) * 100 : 0} tone={cap > 0 && used >= cap ? 'bad' : used >= cap * 0.8 ? 'warn' : 'accent'} size={8} label="Live browser hours used this month" />
        </div>
        <NumberSetting
          key={`cap-${cap}`}
          label="Browser hours cap"
          hint="No new live session starts once the month's hours reach the cap."
          unit="h"
          value={cap}
          min={0}
          max={10000}
          disabled={!canEdit}
          onAsk={(n) => ask('browserHoursCap', n)}
        />
        {confirmRow(['browserHoursCap'])}
        <NumberSetting
          key={`idle-${settings.idleMinutes}`}
          label="Idle stop"
          hint="A live session with no activity ends after this long."
          unit="min"
          value={settings.idleMinutes}
          min={2}
          max={60}
          disabled={!canEdit}
          onAsk={(n) => ask('idleMinutes', n)}
        />
        {confirmRow(['idleMinutes'])}
        <NumberSetting
          key={`max-${settings.maxMinutes}`}
          label="Hard stop"
          hint="A live session ends after this long in all."
          unit="min"
          value={settings.maxMinutes}
          min={10}
          max={240}
          disabled={!canEdit}
          onAsk={(n) => ask('maxMinutes', n)}
        />
        {confirmRow(['maxMinutes'])}
        <Row title="One run per portal login" hint="Only one open live session for each portal login at a time.">
          <Switch aria-label="One run per portal login" checked={settings.onePerLogin} disabled={!canEdit} onCheckedChange={(on) => ask('onePerLogin', on)} />
        </Row>
        {confirmRow(['onePerLogin'])}
      </DashSection>

      <DashSection title="Recipes" flush>
        <Row
          title={
            admin
              ? `${admin.recipes.recipes} recipes · ${admin.recipes.beta} beta · ${admin.recipes.live} live · ${admin.patchesWaiting} patch proposal${admin.patchesWaiting === 1 ? '' : 's'} waiting`
              : 'Recipes'
          }
          hint="A recipe is how an agent reaches each field of a form. When an agent finds a better way, it proposes a patch for review."
        >
          <Link href={`/app/${seg}/assist-runs#recipe-fixes`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Review patches
          </Link>
        </Row>
      </DashSection>
    </div>
  );
}

export default function AgentSettingsPage({ path }: { path: string }) {
  const { user } = useApp();
  const firmAdmin = isFirmWideAdmin(user?.role);
  const query = useAgentSettingsPage(firmAdmin);
  return (
    <PageTransition>
      <SEO title="Agent settings — VCFO Suite" description="The card agents' kill switch, routes, limits and recipes." path={path} />
      <div className="flex flex-col gap-4">
        <h1 className="text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink">Agent settings</h1>
        {!firmAdmin ? (
          <EmptyState title="Only an admin can open Agent settings." />
        ) : query.isPending ? (
          <SkeletonRows rows={8} />
        ) : query.isError || !query.data ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
            Could not load the agent settings. Refresh the page.
          </p>
        ) : (
          <AgentSettingsBody data={query.data} />
        )}
      </div>
    </PageTransition>
  );
}
