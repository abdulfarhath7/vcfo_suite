"use client";

import type { Dispatch, SetStateAction } from 'react';
import type { useRouter } from 'next/navigation';
import Link from 'next/link';
import { m as motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { ArrowRight, Plus, Table as TableIcon, LayoutGrid, MapPin, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Surface, StatusDot, Mono, Eyebrow, EmptyStateIllustrated } from '@/components/noir';
import { staggerKids, fadeUp } from '@/lib/motion';
import { adminProjectPath } from '@/lib/project-step-path';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { ProjectActionsMenu } from '@/components/admin/ProjectActionsMenu';
import type { Engagement } from '@/data/engagements';
import { STUCK_LABEL } from '@/lib/project-stuck';

type View = 'table' | 'board';
type Router = ReturnType<typeof useRouter>;

interface EnrichedItem {
  e: Engagement;
  pct: number;
  done: number;
  total: number;
  intern: { id: string; name: string; initials?: string } | undefined;
  leads?: Array<{ id: string; name: string; initials?: string }>;
  city: { name: string; x: number; y: number };
  stuck: import('@/lib/project-stuck').StuckReason;
}

export interface ProjectsViewProps {
  engagements: Engagement[];
  teamMembers: Array<{ id: string; name: string; initials?: string }>;
  internOptions: Array<{ id: string; name: string; initials?: string }>;
  engagementsLoading: boolean;
  router: Router;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  enriched: EnrichedItem[];
}

const healthMap = {
  'on-track': { label: 'On track', cls: 'bg-success-light text-success-text', dot: 'bg-success', tone: 'success' as const },
  'at-risk':  { label: 'Needs review',  cls: 'bg-warning-light text-warning-text', dot: 'bg-warning', tone: 'warning' as const },
  'overdue':  { label: 'Past due',  cls: 'bg-danger-light text-danger-text',   dot: 'bg-danger',  tone: 'danger'  as const },
} as const;

const PHASE_ORDER = ['Pre-Incorporation', 'Post-Incorporation', 'Operational Readiness'] as const;

const VIEWS = [
  { id: 'table', label: 'Table', icon: TableIcon },
  { id: 'board', label: 'Board', icon: LayoutGrid },
] as const;

export function ProjectsView(props: ProjectsViewProps) {
  const {
  engagements,
  engagementsLoading,
  router,
  view,
  setView,
  enriched,
  } = props;

  return (
    <PageTransition>
      <SEO title="GCC Setup Projects — VCFO Suite" description="Portfolio of GCC setup projects — phase, delivery owner, and health at a glance." path="/app/manager/projects" />

      <PageHeader
        accent="primary"
        icon={Briefcase}
        title="GCC Setup Projects"
        subtitle={`${engagements.length} project${engagements.length === 1 ? '' : 's'}`}
        actions={
          <div className="flex items-center gap-2">
            <LayoutGroup id="proj-view-switch">
              <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
                {VIEWS.map((v) => {
                  const Icon = v.icon;
                  const active = view === v.id;
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => setView(v.id)}
                      className={cn(
                        'relative inline-flex items-center gap-1.5 px-2.5 h-7 rounded-[5px] text-[12px] font-medium transition-colors',
                        active ? 'text-ink' : 'text-text-tertiary hover:text-ink-soft',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="proj-view-pill"
                          className="absolute inset-0 rounded-[5px] bg-muted"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon className="w-3.5 h-3.5 relative" />
                      <span className="relative">{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
            <Link
              href="/app/manager/projects/new"
              className="h-9 px-3 rounded-md gold-sheen text-[12.5px] font-medium hover:opacity-95 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Start GCC project
            </Link>
          </div>
        }
      />

      <AnimatePresence mode="wait">
        {view === 'table' && (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="surface overflow-hidden"
          >
            {engagementsLoading && (
              <div className="flex items-center justify-center py-12">
                <HexgridLoader size="sm" message="Pulling your portfolio…" />
              </div>
            )}
            {!engagementsLoading && enriched.length === 0 && (
              <div className="p-6 sm:p-8">
                <EmptyStateIllustrated
                  icon={Briefcase}
                  title="No GCC setup projects yet"
                  description="Start a project to provision the client portal and phase checklist."
                  actionLabel="Start GCC project"
                  onAction={() => router.push('/app/manager/projects/new')}
                  className="border-0 bg-transparent py-8 shadow-none"
                />
              </div>
            )}
            {!engagementsLoading && enriched.length > 0 && (
            <>
            {/* Mobile card stack */}
            <div className="space-y-2 p-3 md:hidden">
              {enriched.map(({ e, pct, intern, leads, stuck }) => {
                const h = healthMap[e.health];
                const leadLabel =
                  leads && leads.length > 0
                    ? leads.map((l) => l.name).join(', ')
                    : (intern?.name ?? 'Unassigned');
                return (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(adminProjectPath(e))}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') router.push(adminProjectPath(e));
                    }}
                    className="flex w-full cursor-pointer flex-col gap-2.5 rounded-xl border border-border/80 bg-card px-3.5 py-3 text-left transition-colors hover:border-orange-200 hover:bg-orange-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-light text-[11px] font-semibold text-brand">
                          {e.companyName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-ink">{e.companyName}</div>
                          <div className="text-[11px] text-text-tertiary">
                            {e.stage} · {STUCK_LABEL[stuck]}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', h.cls)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', h.dot)} />
                          {h.label}
                        </span>
                        <ProjectActionsMenu engagement={e} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] tabular-nums text-text-tertiary">{pct}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[11.5px] text-text-tertiary">
                      <span className="truncate">{leadLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-orange-600/70" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.6fr_1fr_1.2fr_1fr_120px_88px] gap-3 px-4 h-10 items-center bg-table-header text-[11px] uppercase tracking-wider text-text-tertiary border-b border-border">
              <div>Company</div>
              <div>Setup phase</div>
              <div>Progress</div>
              <div>Delivery owner</div>
              <div>Health</div>
              <div></div>
            </div>
            <motion.div
              className="divide-y divide-border"
              initial="hidden"
              animate="show"
              variants={staggerKids(0.03)}
            >
              {enriched.map(({ e, pct, intern, leads, stuck }) => {
                const h = healthMap[e.health];
                const leadLabel =
                  leads && leads.length > 0
                    ? leads.map((l) => l.name).join(', ')
                    : (intern?.name ?? 'Unassigned');
                return (
                  <motion.div
                    key={e.id}
                    variants={fadeUp}
                    className="w-full grid grid-cols-[1.6fr_1fr_1.2fr_1fr_120px_88px] gap-3 px-4 py-3 items-center hover:bg-muted/40 text-left group"
                  >
                    <button type="button" onClick={() => router.push(adminProjectPath(e))} className="contents">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-primary-light text-brand text-[11px] font-semibold flex items-center justify-center shrink-0">
                        {e.companyName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink truncate">{e.companyName}</div>
                        <div className="text-[11px] text-text-tertiary">{STUCK_LABEL[stuck]}</div>
                      </div>
                    </div>
                    <div className="text-[12.5px] text-ink-soft">{e.stage}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-text-tertiary tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full gold-sheen text-[10px] font-semibold flex items-center justify-center shrink-0">{intern?.initials}</span>
                      <span className="text-[12.5px] text-ink-soft truncate">{leadLabel}</span>
                    </div>
                    <span className={cn('inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[10.5px] font-medium w-fit', h.cls)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', h.dot)} />{h.label}
                    </span>
                    </button>
                    <div className="flex items-center justify-end gap-1">
                      <ProjectActionsMenu engagement={e} />
                      <button type="button" onClick={() => router.push(adminProjectPath(e))} className="p-1.5 text-text-tertiary hover:text-ink">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
            </div>
            </div>
            </>
            )}
          </motion.div>
        )}

        {view === 'board' && (
          <motion.div
            key="board"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            variants={staggerKids(0.05)}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          >
            {PHASE_ORDER.map((phase) => {
              const items = enriched.filter((x) => x.e.stage === phase);
              return (
                <motion.div key={phase} variants={fadeUp} className="flex flex-col min-h-[320px]">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <StatusDot tone="gold" size={6} />
                      <Eyebrow>{phase}</Eyebrow>
                    </div>
                    <Mono className="text-[10.5px] text-text-tertiary">{items.length.toString().padStart(2, '0')}</Mono>
                  </div>
                  <Surface flat className="flex-1 p-2 space-y-2 bg-muted/20">
                    {items.length === 0 && (
                      <div className="h-full min-h-[200px] flex items-center justify-center text-[11.5px] text-text-tertiary italic">
                        No projects in this setup phase
                      </div>
                    )}
                    {items.map(({ e, pct, intern, city }, i) => {
                      const h = healthMap[e.health];
                      return (
                        <motion.button
                          key={e.id}
                          layout
                          variants={fadeUp}
                          onClick={() => router.push(adminProjectPath(e))}
                          className="group w-full text-left rounded-md border border-border bg-card p-3 hover:border-hairline-strong hover:-translate-y-px transition-all"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-md bg-primary-light text-brand text-[10px] font-semibold flex items-center justify-center shrink-0">
                                {e.companyName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12.5px] font-medium text-ink truncate">{e.companyName}</div>
                                <div className="text-[10.5px] text-text-tertiary flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5" />{city.name}
                                </div>
                              </div>
                            </div>
                            <StatusDot tone={h.tone} size={7} />
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-gold to-gold/70"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, delay: 0.1 + i * 0.04 }}
                              />
                            </div>
                            <Mono className="text-[10px] text-text-tertiary tabular-nums w-7 text-right">{pct}%</Mono>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full gold-sheen text-[9px] font-semibold flex items-center justify-center">{intern?.initials}</span>
                              <span className="text-[10.5px] text-text-tertiary truncate max-w-[100px]">{intern?.name}</span>
                            </div>
                            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{h.label}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </Surface>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
