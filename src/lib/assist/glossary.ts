import { GLOSSARY } from '@/data/assist/glossary';
import type { GlossaryTerm, ProjectSnapshot } from '@/data/assist/schema';
import { appliesTo, applicabilityFromSnapshot } from '@/lib/assist/topics';

/** Glossary entries that apply to this viewer (FC-GPR hidden for domestic companies). */
export function glossaryFor(snapshot: ProjectSnapshot | null): GlossaryTerm[] {
  const ctx = applicabilityFromSnapshot(snapshot);
  return GLOSSARY.filter((g) => appliesTo(g.appliesTo, ctx));
}

/** Term or alias, case-insensitive. */
export function findGlossaryTerm(text: string): GlossaryTerm | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  return (
    GLOSSARY.find((g) => g.term.toLowerCase() === q || g.aliases.some((a) => a.toLowerCase() === q)) ?? null
  );
}
