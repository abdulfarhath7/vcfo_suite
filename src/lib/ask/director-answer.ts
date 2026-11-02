import type { AnswerEnvelope } from '@/data/ask/schema';
import { findDinInMessage } from '@/lib/director-lookup/din';
import type { DinLookupResult, DirectorCompany } from '@/lib/director-lookup/types';

/**
 * DIN lookup replies (staff shells). Built here, never by the model: a DIN and
 * a director's name are personal data that must not reach the model (§1 rule
 * 9), so this answer is deterministic and its turn is kept out of the history
 * later model calls see (`withoutDirectorLookups`).
 */
export const MCA_PORTAL_URL = 'https://www.mca.gov.in/';
const MCA_PATH = 'MCA Services → Master Data → View Director Master Data';

const MAX_CURRENT_FACTS = 4;

function istStamp(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function isoToDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function currentFact(c: DirectorCompany): { k: string; v: string } {
  const role = c.designation ?? 'Director';
  const since = c.appointedOn ? ` since ${isoToDay(c.appointedOn)}` : '';
  const cin = c.cin ? ` · ${c.cin}` : '';
  return { k: clip(c.name, 60), v: clip(`${role}${since}${cin}`, 200) };
}

function pastYears(c: DirectorCompany): string {
  const from = c.appointedOn?.slice(0, 4);
  const to = c.ceasedOn?.slice(0, 4);
  return from && to ? `${c.name} (${from}–${to})` : c.name;
}

function base(line: string, extra: Partial<AnswerEnvelope> = {}): AnswerEnvelope {
  return { line: clip(line, 1200), citations: [], actions: [], origin: 'deterministic', depth: 'normal', ...extra };
}

const mcaCitation = { id: 'mca-portal', label: `MCA portal — ${MCA_PATH}`, url: MCA_PORTAL_URL };

export function directorLookupAnswer(result: DinLookupResult): AnswerEnvelope {
  if (result.kind === 'unavailable') {
    const line =
      result.reason === 'not_configured'
        ? `Live DIN lookup is not switched on yet. Check DIN ${result.din} on the MCA portal: ${MCA_PATH}.`
        : `The DIN lookup service did not answer for DIN ${result.din}. Try again in a minute, or check it on the MCA portal: ${MCA_PATH}.`;
    return base(line, { citations: [mcaCitation] });
  }

  const source = { id: 'director-lookup', label: clip(`${result.sourceLabel} · fetched ${istStamp(result.fetchedAt)}`, 200) };
  const why = `Fetched live just now, not from stored data. Confirm on the MCA portal before relying on it for a filing.`;

  if (result.kind === 'not_found') {
    return base(`No director found for DIN ${result.din}. Check the number: a DIN has exactly 8 digits.`, {
      why,
      citations: [source, mcaCitation],
    });
  }

  const { record } = result;
  const current = record.companies.filter((c) => !c.ceasedOn);
  const past = record.companies.filter((c) => c.ceasedOn);

  let line = `${record.name} (DIN ${record.din}) — DIN status: ${record.dinStatus}. `;
  line +=
    current.length === 0
      ? 'No current directorships on record.'
      : `Director in ${current.length} ${current.length === 1 ? 'company' : 'companies'} now`;
  if (current.length > 0) line += past.length > 0 ? `, ${past.length} in the past.` : '.';
  if (record.active === false) {
    line += /kyc/i.test(record.dinStatus)
      ? ' This DIN is inactive: the director must file DIR-3 KYC to reactivate it before signing any filing.'
      : ' This DIN is not active.';
  }

  const facts: Array<{ k: string; v: string }> = [{ k: 'DIN status', v: clip(record.dinStatus, 200) }];
  facts.push(...current.slice(0, MAX_CURRENT_FACTS).map(currentFact));
  if (current.length > MAX_CURRENT_FACTS) {
    facts.push({ k: 'More', v: `${current.length - MAX_CURRENT_FACTS} more current directorships` });
  } else if (past.length > 0) {
    facts.push({ k: 'Past', v: clip(past.map(pastYears).join('; '), 200) });
  } else if (facts.length < 2) {
    facts.push({ k: 'Companies', v: 'None on record' });
  }

  return base(line, {
    why,
    title: `${record.name} — DIN ${record.din}`,
    visual: { type: 'keyFacts', facts: facts.slice(0, 6) },
    citations: [source, mcaCitation],
  });
}

/**
 * Drops each DIN question and the reply after it from the history handed to
 * the model, so a later question in the same chat never carries a director's
 * details to it.
 */
export function withoutDirectorLookups<T extends { sender: 'user' | 'assistant'; text: string }>(history: T[]): T[] {
  const out: T[] = [];
  let skipReply = false;
  for (const m of history) {
    if (m.sender === 'user') {
      skipReply = findDinInMessage(m.text) !== null;
      if (!skipReply) out.push(m);
    } else if (skipReply) {
      skipReply = false;
    } else {
      out.push(m);
    }
  }
  return out;
}
