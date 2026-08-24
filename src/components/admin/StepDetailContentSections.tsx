'use client';

import { m as motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { STATUS_LABEL, copyMentionsWorkingDaysSla } from '@/data/checklist';
import { MilestoneResponseForm } from '@/views/incorporation/MilestoneResponseForm';
import { Phase1StepPanel } from '@/components/incorporation/Phase1StepPanel';
import { ChecklistInlineTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { ChecklistReviewActions } from '@/components/admin/ChecklistReviewActions';
import { RequestManagerApproval } from '@/components/admin/RequestManagerApproval';
import { InternStepActionBar } from '@/components/admin/InternStepActionBar';
import { BoardResolutionStepLink } from '@/components/incorporation/BoardResolutionStepLink';
import { StepWorkspaceRail } from '@/components/admin/StepWorkspaceRail';
import { Eyebrow, Mono, GoldDivider, StatusDot, GoldButton } from '@/components/noir';
import {
  CheckCircle2,
  Circle,
  FileText,
  Upload,
  Activity as ActivityIcon,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeUp, staggerKids } from '@/lib/motion';

const PHASE1_PANEL_IDS = [
  'pre-2',
  'pre-3',
  'pre-4',
  'pre-5',
  'pre-7',
  'pre-8',
  'pre-9',
  'pre-10',
  'pre-11',
  'pre-12',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StepDetailContentView(props: any) {
  const {
    item,
    engagementId,
    responses,
    onDone,
    contentReady,
    hideDocumentsTab,
    hideTimeline,
    hideStatus,
    hideWorkspaceRail,
    progress,
    tab,
    setTab,
    justCompleted,
    isLight,
    scopeId,
    hasClientFields,
    showLegacyChecklist,
    stepActivity,
    totals,
    engagement,
    itemState,
    status,
    tone,
    statusCls,
    preIncPhaseStep,
    toggleForm,
    toggleDoc,
    markAll,
    rowBtn,
    tabTrigger,
    emptyCopy,
    bodyText,
    stepGate,
    formReadOnly,
    theme,
  } = props;

  const notesForView =
    item.notes && (!hideTimeline || !copyMentionsWorkingDaysSla(item.notes)) ? item.notes : null;
  const showDeadline = Boolean(item.deadline) && !hideTimeline;

  const justCompletedBanner = (
    <AnimatePresence>
      {justCompleted && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            'flex items-center gap-2 border px-3 py-2 rounded-md',
            isLight
              ? 'mb-3 border-brand/30 bg-primary-light text-ink'
              : 'mt-4 border-primary/40 bg-primary/5 rounded-sm',
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          <span className={cn('text-[12px]', isLight ? 'text-ink' : 'text-paper')}>
            All requirements met — step marked complete.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const phase1Panel =
    PHASE1_PANEL_IDS.includes(item.id) && engagement ? (
      <Phase1StepPanel
        item={item}
        engagement={engagement}
        responses={responses}
        variant="admin"
        className={isLight ? undefined : 'mb-6'}
      />
    ) : null;

  const internActionBar = hideWorkspaceRail ? (
    <InternStepActionBar
      engagementId={engagementId}
      item={item}
      itemState={itemState}
      showLegacyChecklist={showLegacyChecklist}
      totalsPct={totals.pct}
      onMarkAll={showLegacyChecklist ? markAll : undefined}
    />
  ) : null;

  const internBoardResolutionAction =
    hideWorkspaceRail && item.id === 'pre-2' && engagement ? (
      <BoardResolutionStepLink engagement={engagement} />
    ) : null;

  const internFooterFallback =
    hideWorkspaceRail && internActionBar && !hasClientFields;

  const responseForm =
    hasClientFields && scopeId ? (
      <MilestoneResponseForm
        key={`${item.id}-${engagementId}`}
        item={item}
        clientId={scopeId}
        engagementId={engagementId}
        responses={responses}
        variant="admin"
        showFieldUnlock={!hideWorkspaceRail}
        open={contentReady}
        readOnly={formReadOnly ?? !stepGate?.canEdit}
        compactChrome={isLight}
        extraFooterActions={hideWorkspaceRail ? internActionBar : undefined}
        aboveFooterActions={internBoardResolutionAction ?? undefined}
        sectionTabs={hideWorkspaceRail}
      />
    ) : null;

  const legacyChecklist = showLegacyChecklist ? (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList
          className={cn(
            'bg-transparent rounded-none h-auto p-0 w-full justify-start gap-1 mb-4',
            isLight ? 'border-b border-border' : 'border-b border-hairline',
          )}
        >
          {[
            { v: 'forms' as const, icon: FileCheck, label: 'Forms', n: item.forms.length },
            ...(!hideDocumentsTab
              ? [{ v: 'docs' as const, icon: FileText, label: 'Documents', n: item.infoRequired.length }]
              : []),
            { v: 'activity' as const, icon: ActivityIcon, label: 'Activity', n: stepActivity.length },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.v;
            return (
              <TabsTrigger key={t.v} value={t.v} className={tabTrigger}>
                <span className="flex items-center gap-2">
                  <Icon className="w-3 h-3" />
                  {t.label}
                  <span
                    className={cn(
                      'tabular-nums',
                      isLight ? 'text-text-tertiary' : 'text-paper-subtle',
                    )}
                  >
                    {t.n}
                  </span>
                </span>
                {active && (
                  <motion.span
                    layoutId={isLight ? 'step-tab-underline-page' : 'step-tab-underline'}
                    className={cn(
                      'absolute left-2 right-2 -bottom-px h-[2px]',
                      isLight ? 'bg-brand' : 'bg-gold',
                    )}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="forms" className="focus-visible:ring-0">
          {item.forms.length === 0 ? (
            <p className={cn('text-[12.5px] py-6', emptyCopy)}>No statutory forms for this step.</p>
          ) : (
            <motion.ul
              variants={staggerKids(0.04)}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {item.forms.map((f: string) => {
                const done = progress.forms.includes(f);
                return (
                  <motion.li key={f} variants={fadeUp}>
                    <button type="button" onClick={() => toggleForm(f)} className={rowBtn(done)}>
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <Circle
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isLight ? 'text-text-tertiary' : 'text-paper-subtle',
                          )}
                        />
                      )}
                      <Mono
                        className={cn(
                          'text-[12px] tracking-[0.06em] flex-1',
                          done
                            ? isLight
                              ? 'text-brand'
                              : 'text-blue-500'
                            : isLight
                              ? 'text-ink'
                              : 'text-paper',
                        )}
                      >
                        {f}
                      </Mono>
                      <span
                        className={cn(
                          'text-[10px] mono uppercase tracking-[0.16em]',
                          isLight ? 'text-text-tertiary' : 'text-paper-subtle',
                        )}
                      >
                        {done ? 'Filed' : 'To file'}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </TabsContent>

        {!hideDocumentsTab && (
          <TabsContent value="docs" className="focus-visible:ring-0">
            {item.infoRequired.length === 0 ? (
              <p className={cn('text-[12.5px] py-6', emptyCopy)}>
                No evidence required for this step.
              </p>
            ) : (
              <motion.ul
                variants={staggerKids(0.03)}
                initial="hidden"
                animate="show"
                className="space-y-1.5"
              >
                {item.infoRequired.map((d: string) => {
                  const done = progress.docs.includes(d);
                  return (
                    <motion.li key={d} variants={fadeUp}>
                      <button type="button" onClick={() => toggleDoc(d)} className={cn(rowBtn(done), 'group items-start')}>
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        ) : (
                          <Upload
                            className={cn(
                              'w-4 h-4 shrink-0 mt-0.5 transition-colors group-hover:text-blue-600',
                              isLight ? 'text-text-tertiary' : 'text-paper-subtle',
                            )}
                          />
                        )}
                        <span className={cn('text-[12.5px] flex-1 leading-relaxed', bodyText(done))}>
                          {d}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] mono uppercase tracking-[0.16em] shrink-0 mt-0.5',
                            isLight ? 'text-text-tertiary' : 'text-paper-subtle',
                          )}
                        >
                          {done ? 'On file' : 'Outstanding'}
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </TabsContent>
        )}

        <TabsContent value="activity" className="focus-visible:ring-0">
          {stepActivity.length === 0 ? (
            <p className={cn('text-[12.5px] py-6', emptyCopy)}>
              No activity logged for this step yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {stepActivity.map((a: { id: string; actor: string; verb: string; target?: string; at: string }) => (
                <li
                  key={a.id}
                  className={cn(
                    'text-[12.5px] leading-relaxed border-l pl-3',
                    isLight ? 'border-border' : 'border-hairline',
                  )}
                >
                  <span className={isLight ? 'text-ink' : 'text-paper'}>{a.actor}</span>{' '}
                  <span className={isLight ? 'text-text-secondary' : 'text-paper-muted'}>
                    {a.verb}
                  </span>{' '}
                  {a.target && (
                    <span className={isLight ? 'text-brand' : 'text-blue-500'}>{a.target}</span>
                  )}
                  <div
                    className={cn(
                      'text-[10px] mono uppercase tracking-[0.14em] mt-1',
                      isLight ? 'text-text-tertiary' : 'text-paper-subtle',
                    )}
                  >
                    {a.at}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {notesForView || showDeadline ? (
        <div className="mt-6">
          <GoldDivider className="mb-3" />
          <Eyebrow className={cn('mb-2', isLight && 'text-text-tertiary')}>Step notes</Eyebrow>
          {notesForView && (
            <p className={cn('text-[12px] leading-relaxed', isLight ? 'text-text-secondary' : 'text-paper-muted')}>
              {notesForView}
            </p>
          )}
          {showDeadline && (
            <Mono
              className={cn(
                'text-[10px] uppercase tracking-[0.18em] mt-2 block',
                isLight ? 'text-text-tertiary' : 'text-paper-subtle',
              )}
            >
              Deadline · {item.deadline.kind.replace(/-/g, ' ')}
              {'days' in item.deadline && ` · ${item.deadline.days}d`}
              {'weeks' in item.deadline &&
                ` · ${Array.isArray(item.deadline.weeks) ? item.deadline.weeks.join('–') : item.deadline.weeks}w`}
            </Mono>
          )}
        </div>
      ) : null}
    </>
  ) : null;

  if (isLight) {
    const internPageFooter = internFooterFallback ? (
      <div className="sticky bottom-0 z-20 mt-4 border-t border-border/70 bg-panel/95 px-4 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-panel/80">
        <div className="flex flex-wrap items-center gap-2">{internActionBar}</div>
      </div>
    ) : null;

    return (
      <div className="flex min-h-0 flex-col">
        {justCompletedBanner}
        {hideWorkspaceRail ? (
          <div className="min-w-0 space-y-4">
            {item.id !== 'pre-7' ? phase1Panel : null}
            {responseForm}
            {item.id === 'pre-7' ? phase1Panel : null}
            {legacyChecklist}
            {internPageFooter}
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18.5rem)] lg:items-start lg:gap-5">
            <div className="min-w-0 space-y-3">
              {phase1Panel}
              {responseForm}
              <div className="lg:hidden empty:hidden">
                <RequestManagerApproval
                  engagementId={engagementId}
                  itemId={item.id}
                  itemState={itemState}
                  emphasis="primary"
                />
              </div>
              {legacyChecklist}
            </div>
            <StepWorkspaceRail
              item={item}
              status={status}
              statusCls={statusCls}
              engagementId={engagementId}
              itemState={itemState}
              responses={responses}
              activity={stepActivity}
              stepGate={stepGate}
              theme={theme}
              showLegacyChecklist={showLegacyChecklist}
              hideTimeline={hideTimeline}
              hideStatus={hideStatus}
              totalsPct={totals.pct}
              onMarkAll={showLegacyChecklist ? markAll : undefined}
              className="mt-4 lg:sticky lg:top-[var(--shell-sticky-top)] lg:mt-0"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-3 px-6 pt-6 pb-4 text-left border-b border-hairline">
        <div className="flex items-center justify-between">
          <Eyebrow>Step · {item.bucket.replace('-', ' ')}</Eyebrow>
          <Mono className="text-[10px] uppercase tracking-[0.18em] text-paper-subtle">
            {String(preIncPhaseStep?.stepNumber ?? item.order).padStart(2, '0')} / {item.id}
          </Mono>
        </div>
        <h1 className="serif leading-tight font-normal text-paper text-[22px]">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ResponsibleRoleBadge role={item.responsibleRole} />
        </div>
        {item.description && (
          <p className="text-[13px] leading-relaxed pt-1 text-paper-muted">{item.description}</p>
        )}
        {item.notes && (
          <p className="text-[12px] leading-relaxed pt-1 text-paper-subtle">{item.notes}</p>
        )}
        <div className="flex items-center gap-3 pt-1">
          {!hideStatus && (
            <>
              <StatusDot tone={tone.dot} size={8} pulse={status === 'in-progress'} />
              <span className={cn('text-[10.5px] mono uppercase tracking-[0.18em]', statusCls)}>
                {STATUS_LABEL[status]}
              </span>
            </>
          )}
          {!hideTimeline && (
            <ChecklistInlineTimeline item={item} className="normal-case tracking-normal text-paper-subtle" />
          )}
          {showLegacyChecklist && (
            <>
              <span className="text-paper-subtle">·</span>
              <Mono className="text-[10.5px] uppercase tracking-[0.18em] text-paper-muted">
                {totals.done}/{totals.total} items
              </Mono>
            </>
          )}
        </div>
        {showLegacyChecklist && (
          <div className="relative h-[3px] overflow-hidden rounded-full mt-2 bg-raised">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold to-gold-hi"
              initial={false}
              animate={{ width: `${totals.pct}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        )}
      </header>

      {justCompletedBanner}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {phase1Panel}
        {hasClientFields && scopeId && (
          <div className="mb-6 space-y-4">
            <ChecklistReviewActions
              engagementId={engagementId}
              itemId={item.id}
              itemState={itemState}
              theme={theme}
            />
            <RequestManagerApproval
              engagementId={engagementId}
              itemId={item.id}
              itemState={itemState}
            />
            {stepGate?.kind === 'waiting' && stepGate.message && (
              <div className="rounded-lg border border-warning/30 bg-warning-light/60 px-3 py-2.5 text-sm text-warning-text">
                {stepGate.message}
              </div>
            )}
            {responseForm}
          </div>
        )}
        {legacyChecklist}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-4 bg-panel">
        <Mono className="text-[10.5px] uppercase tracking-[0.18em] text-paper-muted">
          {showLegacyChecklist ? `${totals.pct}% of requirements met` : ''}
        </Mono>
        <div className="flex items-center gap-2">
          <GoldButton variant="ghost" size="sm" onClick={onDone}>
            Done
          </GoldButton>
          {showLegacyChecklist && (
            <GoldButton size="sm" onClick={markAll} disabled={totals.pct === 100}>
              Mark all complete
            </GoldButton>
          )}
        </div>
      </footer>
    </div>
  );
}
