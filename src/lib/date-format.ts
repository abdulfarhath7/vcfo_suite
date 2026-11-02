/**
 * Date wording rules (K-13, rule R-29): write "14 Sep", never "14 Sept". The
 * en-GB and en-IN locale data in modern ICU spell September "Sept", so every
 * display date passes through `sep`.
 */
export function sep(s: string): string {
  return s.replace(/\bSept\b/g, 'Sep');
}

/** 24-hour clock time, for example "09:05" or "15:42" (Asia/Kolkata unless given). */
export function time24(d: Date, timeZone = 'Asia/Kolkata'): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
}
