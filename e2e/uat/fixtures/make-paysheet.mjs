// Builds the October 2026 paysheet for Kaveri Foods (12 employees) and, separately, the expected
// totals worked out by hand-written rules, so the app's registers are checked against
// numbers the app did not produce. Run: node e2e/uat/fixtures/make-paysheet.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ExcelJS = createRequire(import.meta.url)('exceljs');
const here = dirname(fileURLToPath(import.meta.url));
const WORKING_DAYS = 26;
const EMP = [
  ['E001', 'Arjun Kumar', 'Male', '2026-08-05', 'Production Supervisor', 'Production', 32000, 26],
  ['E002', 'Divya Nair', 'Female', '2026-08-05', 'Quality Analyst', 'Quality', 28000, 25],
  ['E003', 'Ravi Teja', 'Male', '2026-08-10', 'Machine Operator', 'Production', 18000, 24],
  ['E004', 'Sunita Devi', 'Female', '2026-08-10', 'Packer', 'Packing', 15000, 26],
  ['E005', 'Mohammed Irfan', 'Male', '2026-08-12', 'Machine Operator', 'Production', 18000, 22],
  ['E006', 'Lakshmi Prasad', 'Female', '2026-08-15', 'Store Keeper', 'Stores', 20000, 26],
  ['E007', 'Vikram Singh', 'Male', '2026-08-15', 'Driver', 'Logistics', 17000, 23],
  ['E008', 'Pooja Hegde', 'Female', '2026-08-20', 'Accounts Assistant', 'Accounts', 22000, 26],
  ['E009', 'Naveen Gowda', 'Male', '2026-08-20', 'Helper', 'Production', 14000, 20],
  ['E010', 'Shabana Begum', 'Female', '2026-09-01', 'Packer', 'Packing', 15000, 26],
  ['E011', 'Rahul Menon', 'Male', '2026-09-01', 'Maintenance Technician', 'Maintenance', 24000, 25],
  ['E012', 'Kavya Reddy', 'Female', '2026-09-15', 'HR Executive', 'HR', 26000, 26],
];

// The rules, written out plainly:
//   earned gross = monthly salary × days worked ÷ 26, rounded to the rupee
//   basic = 50% of earned gross; HRA = 20%; special allowance = the rest
//   PF = 12% of basic, on basic up to ₹15,000
//   ESI = 0.75% of earned gross, rounded up, only when the monthly salary is ₹21,000 or less
//   PT (Karnataka) = ₹200 when the monthly salary is ₹25,000 or more, else nil
//   net = gross − PF − ESI − PT
const rows = EMP.map(([id, name, sex, doj, desig, dept, salary, days]) => {
  const gross = Math.round((salary * days) / WORKING_DAYS);
  const basic = Math.round(gross * 0.5);
  const hra = Math.round(gross * 0.2);
  const special = gross - basic - hra;
  const pf = Math.round(Math.min(basic, 15000) * 0.12);
  const esi = salary <= 21000 ? Math.ceil(gross * 0.0075) : 0;
  const pt = salary >= 25000 ? 200 : 0;
  const net = gross - pf - esi - pt;
  return { id, name, sex, doj, desig, dept, salary, days, gross, basic, hra, special, pf, esi, pt, net };
});
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const expected = { period: '2026-10', workingDays: WORKING_DAYS, employees: rows.length, gross: sum('gross'), basic: sum('basic'), hra: sum('hra'), pf: sum('pf'), esi: sum('esi'), pt: sum('pt'), net: sum('net'), rows };

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Paysheet Oct 2026');
// October 2026: 31 days, 4 Sundays (weekly offs), 1 holiday (Gandhi Jayanti, 2 Oct) → 26 working days.
// Absence is first taken from leave (up to 2 days), the rest is loss of pay; 12 days of leave a year.
ws.addRow(['Employee ID', 'Employee Name', "Father's name", 'Gender', 'Date of birth', 'Date of Joining', 'Designation', 'Department', 'Working days', 'Days worked', 'Weekly off', 'Holidays', 'Leave availed', 'Leave balance', 'Loss of pay days', 'Overtime hours', 'Overtime wages', 'Basic', 'HRA', 'Special allowance', 'Gross', 'PF', 'ESI', 'PT', 'TDS', 'Total deductions', 'Net pay', 'Date of payment']);
for (const r of rows) {
  const absent = WORKING_DAYS - r.days;
  const leave = Math.min(2, absent);
  ws.addRow([r.id, r.name, `${r.name.split(' ')[1] ?? 'Kumar'} Senior`, r.sex, '1992-01-01', r.doj, r.desig, r.dept, WORKING_DAYS, r.days, 4, 1, leave, 12 - leave, absent - leave, 0, 0, r.basic, r.hra, r.special, r.gross, r.pf, r.esi, r.pt, 0, r.pf + r.esi + r.pt, r.net, '2026-11-01']);
}
await wb.xlsx.writeFile(join(here, 'files', 'paysheet-oct-2026.xlsx'));

writeFileSync(join(here, 'expected-payroll.json'), JSON.stringify(expected, null, 2));
console.log(JSON.stringify({ gross: expected.gross, pf: expected.pf, esi: expected.esi, pt: expected.pt, net: expected.net }));
