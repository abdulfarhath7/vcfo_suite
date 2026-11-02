'use client';

/** Section key → the component rendered inside its `<section class="sec">` frame (see Shell.tsx). */
import type { ComponentType } from 'react';
import type { SectionKey } from './runtime';
import { HomeSection } from './sections/home/HomeSection';
import { IncorporationSection } from './sections/incorporation/IncorporationSection';
import { RegistrationsSection } from './sections/registrations/RegistrationsSection';
import { ObligationsSection } from './sections/obligations/ObligationsSection';
import { MasterSection } from './sections/master/MasterSection';
import { CalendarSection } from './sections/calendar/CalendarSection';
import { FilingsSection } from './sections/filings/FilingsSection';
import { DocumentsSection } from './sections/documents/DocumentsSection';
import { LibrarySection } from './sections/library/LibrarySection';
import { CredentialsSection } from './sections/credentials/CredentialsSection';
import { TeamSection } from './sections/team/TeamSection';
import { AuditSection } from './sections/audit/AuditSection';
import { SettingsSection } from './sections/settings/SettingsSection';
import { NewcHomeSection } from './sections/newc/NewcHomeSection';
import { NewcMasterDataSection } from './sections/newc/NewcMasterDataSection';
import { NewcSignSection } from './sections/newc/NewcSignSection';

export const SECTION_COMPONENTS: Record<SectionKey, ComponentType> = {
  home: HomeSection,
  incorporation: IncorporationSection,
  registrations: RegistrationsSection,
  obligations: ObligationsSection,
  master: MasterSection,
  calendar: CalendarSection,
  filings: FilingsSection,
  documents: DocumentsSection,
  library: LibrarySection,
  credentials: CredentialsSection,
  team: TeamSection,
  audit: AuditSection,
  settings: SettingsSection,
  nhome: NewcHomeSection,
  nmd: NewcMasterDataSection,
  nsign: NewcSignSection,
};
