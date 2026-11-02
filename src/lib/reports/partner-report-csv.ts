import type { PartnerReportData } from './partner-report';

/**
 * The partner report as a CSV file that Excel opens (P-225). The app has no XLSX package, and
 * the rules forbid adding one, so the "Excel" format is a UTF-8 CSV with a byte-order mark
 * (Excel reads the BOM as UTF-8, so "–" and "·" survive). Same sections and numbers as the PDF
 * and the page (`buildPartnerReport`): a title block, the month's numbers, the managers and the
 * top risks, separated by blank lines. No money (R-37).
 */
function cell(value: string | number): string {
  const s = String(value);
  // Quote when the value has a comma, quote or line break; a leading = + - @ is prefixed so
  // Excel does not read the cell as a formula.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function row(values: Array<string | number>): string {
  return values.map(cell).join(',');
}

export function partnerReportCsv(data: PartnerReportData, opts: { firmName: string; preparedOn: string }): string {
  const lines: string[] = [
    row([`${opts.firmName} partner report`, data.monthLabel]),
    row(['Prepared on', opts.preparedOn]),
    row([data.clientLine]),
    '',
    row(['Number', 'Value']),
    ...data.numbers.map((n) => row([n.k, n.v])),
    '',
    row(['Manager', 'Clients', 'On time', 'Overdue', 'Days to COI']),
    ...data.managers.map((m) => row([m.name, m.clients, m.onTime, m.overdue, m.daysToCoi])),
    '',
    row(['Top risk', 'Client']),
    ...data.risks.map((r) => row([r.title, r.companyName])),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function partnerReportCsvFilename(monthLabel: string): string {
  return `SBC-partner-report-${monthLabel.replace(/\s+/g, '-')}.csv`;
}
