import { GLOSSARY } from '@/data/ask/glossary';
import type { GlossaryTerm } from '@/data/ask/schema';

/** Term or alias, case-insensitive. */
export function findGlossaryTerm(text: string): GlossaryTerm | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  return (
    GLOSSARY.find((g) => g.term.toLowerCase() === q || g.aliases.some((a) => a.toLowerCase() === q)) ?? null
  );
}
