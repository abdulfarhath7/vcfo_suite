'use client';

/**
 * CLIENT PORTAL (redesign, Oct 2026) — the root every signed-in client sees on
 * /app/client/**. A port of the owner's prototype (claude.ai artifact
 * "Northwind Client Portal", source in sbc-vcfo-local/source/portal/v4):
 * one continuous page of sections, popovers for details, step-by-step
 * walkthroughs for multi-step work. Every rule of the prototype CSS is scoped
 * under `.cpx` (scripts/portal-css.mjs), so the staff portals are untouched.
 *
 * ONE portal for every client, whatever the company's stage (owner, 2026-10-29):
 * Home, Updates, Incorporation, Overview, Master data, Declarations,
 * Registrations, Master calendar, Compliances (Calendar, Filings), Documents,
 * Library, Credentials, Team, Audit, Settings. Overview, Master data and
 * Declarations are the prototype's "Client · SBC-GCC" screens, folded in
 * (runtime.tsx PORTAL_SECTIONS).
 *
 * The route pages under app/app/client only send an intent (scroll to a
 * section, open a step …) — see Intent.tsx.
 */
import { useMemo, type ReactNode } from 'react';
import { AskProvider } from '@/components/ask/AskProvider';
import { SPRITE_SVG } from './sprite';
import { PortalProvider, SECTION_LABEL, ToastView, usePaletteItems, usePortal, type PaletteItem } from './runtime';
import { Shell } from './Shell';
import { ModalHost, PopHost, SearchBridge, WizardHost } from './overlays';
import { AskChat } from './sections/ask/AskChat';
import { IntentRunner } from './Intent';
import { useLoadFullChecklist } from './data';
import { useBodyTheme } from './use-body-theme';
import './portal-css';

export function PortalRoot({ fontVars, children }: { fontVars: string; children?: ReactNode }) {
  return (
    <AskProvider>
      <PortalProvider>
        <Root fontVars={fontVars}>{children}</Root>
      </PortalProvider>
    </AskProvider>
  );
}

function Root({ fontVars, children }: { fontVars: string; children?: ReactNode }) {
  const { theme } = usePortal();
  useLoadFullChecklist();
  useBodyTheme(theme);
  return (
    <div className={`cpx ${fontVars}`} data-theme={theme === 'system' ? undefined : theme} data-role="client">
      <div aria-hidden="true" style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: SPRITE_SVG }} />
      <SectionPalette />
      <Shell />
      <AskChat />
      <PopHost />
      <WizardHost />
      <ModalHost />
      <SearchBridge />
      <IntentRunner />
      <ToastView />
      {/* route intent (renders nothing) */}
      {children}
    </div>
  );
}

/** Every section is a search result ("Section"), as in the prototype's palIndex. */
function SectionPalette() {
  const { sections, go } = usePortal();
  const items = useMemo<PaletteItem[]>(
    () => sections.map((k) => ({ id: `sec:${k}`, label: SECTION_LABEL[k], kind: 'Section', sw: 'var(--ink-3)', go: () => go(k) })),
    [sections, go],
  );
  usePaletteItems('sections', items);
  return null;
}
