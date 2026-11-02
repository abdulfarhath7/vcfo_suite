/**
 * Insight pages (Analytics, Audit log, Settings) — small pure helpers: India
 * days and times in the README words, sentence case and CSV. No React.
 */
import { fmt, fmtY, MON, WD } from '@/components/portal/dates';

const IST_MS = 5.5 * 3600e3;

/** A timestamp → the day it falls on in India (YYYY-MM-DD); a plain day passes through. */
export function istDayOf(v?: string | null): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return undefined;
  return new Date(t + IST_MS).toISOString().slice(0, 10);
}

/** "16 Oct" this year, "16 Oct 2025" otherwise. */
export function dWords(day: string, today: string): string {
  return day.slice(0, 4) === today.slice(0, 4) ? fmt(day) : fmtY(day);
}

/** "Today", "Yesterday" or the weekday ("Mon"). */
export function dayName(day: string, today: string): string {
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return WD[new Date(`${day}T00:00:00Z`).getUTCDay()]!;
}

/** "Mon" for a day. */
export const weekdayOf = (day: string): string => WD[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? '';

/** "2:30 pm" in India. */
export function timeIst(ts: string): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + IST_MS);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

/** "14:30" in India (CSV). */
export function hhmmIst(ts: string): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + IST_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "Thu 29 Oct 2026, 2:30 pm" */
export function stampLong(ts: string): string {
  const day = istDayOf(ts);
  if (!day) return '';
  const d = new Date(`${day}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${timeIst(ts)}`;
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "Project Manager" → "Project manager". */
export function sentenceCase(s: string): string {
  const t = s.trim().toLowerCase();
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
}

/** One CSV cell: quoted when needed; a leading = + - @ is defused so a spreadsheet never runs it. */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Save a text file in the browser (with a BOM so spreadsheets read UTF-8). */
export function downloadText(name: string, text: string, mime = 'text/csv;charset=utf-8'): boolean {
  try {
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
