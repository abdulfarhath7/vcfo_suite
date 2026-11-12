// Rewrites a LOCAL demo database so landing-page screenshots carry no real-looking names or identifiers.
// Every text, varchar, json and jsonb column in the public schema is rewritten. Never run against RDS.
import pg from 'pg';

const url = process.env.DATABASE_URL || '';
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Refusing: DATABASE_URL is not a local database');
const pool = new pg.Pool({ connectionString: url });
const q = (s, p) => pool.query(s, p);

const pairs = []; // [POSIX regex, replacement], applied in order
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const add = (from, to) => pairs.push([`\\m${esc(from)}\\M`, to]);
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

// Companies: "Brand Second" first, then the brand alone. The client the landing follows becomes "Your Company".
const { rows: eng } = await q(`select company_name from engagements order by company_name`);
const brands = new Map();
let ci = 1; // Company B, C, ...
for (const { company_name } of eng) {
  const [b, w] = company_name.split(/\s+/);
  if (brands.has(b)) continue;
  const label = b === 'Northwind' ? 'Your Company' : `Company ${ABC[ci++]}`;
  brands.set(b, label);
  if (w && !/^(India|Pvt|Private|LLP|Ltd)/.test(w)) add(`${b} ${w}`, label);
}
for (const [b, label] of brands) add(b, label);

// People: staff by role, client contacts numbered. Full names first, then lone first names.
const { rows: people } = await q(`select role, name from profiles where name is not null`);
const { rows: invites } = await q(`select distinct name from client_invites where name is not null`);
const keep = new Set(['Admin', 'Client', 'Project Lead', 'Project Manager']);
const roleLabel = { intern: 'Lead', manager: 'Manager', admin: 'Admin', developer: 'Developer' };
const all = [...people, ...invites.map((r) => ({ role: 'contact', name: r.name }))];
// The staff the landing follows get the letter A: Bharath (lead), Pranay (manager), Krishna (admin).
const first = new Set(['Bharath', 'Pranay', 'Krishna']);
all.sort((a, b) => Number(first.has(b.name)) - Number(first.has(a.name)) || a.name.localeCompare(b.name));
const counters = {};
const seen = new Set();
const firstNames = new Map();
for (const { role, name } of all) {
  if (keep.has(name) || seen.has(name) || / Client$/.test(name)) continue;
  seen.add(name);
  let label;
  if (role === 'super_admin') label = 'Partner';
  else if (role === 'client' || role === 'contact') label = `Contact ${(counters.c = (counters.c || 0) + 1)}`;
  else {
    counters[role] = (counters[role] || 0) + 1;
    label = `${roleLabel[role] || 'Staff'} ${ABC[counters[role] - 1]}`;
  }
  add(name, label);
  const f = name.split(' ')[0];
  if (name.includes(' ')) firstNames.set(f, firstNames.has(f) && firstNames.get(f) !== label ? 'Contact' : label);
}
// Names the demo text uses that are not profiles; before the lone first names so "Rohan Kumar" goes whole.
for (const [from, to] of [['Mei Tanaka', 'Contact'], ['Rohan Kumar', 'Contact'], ['Mei', 'Contact'], ['Tanaka', 'Contact']]) add(from, to);
for (const [f, label] of firstNames) add(f, label);

// Directors in the questionnaire are stored as separate first and last names: "Director" plus a letter.
for (const f of ['Michael', 'Sarah', 'Thomas', 'Emma', 'Lukas', 'Daniel', 'Olivia']) add(f, 'Director');
const surnames = ['Carter', 'Chatterjee', 'Hughes', 'Menon', 'Tan', 'Bhat', 'Schmidt', 'Joshi', 'Gupta', 'Sharma', 'Wright', 'Agarwal', 'Lim', 'Reddy', 'Pillai', 'Kapoor', 'Müller', 'Kumar', 'Iyer', 'Mehta', 'Kulkarni', 'Bose', 'Mathew', 'Krishnan', 'Rao'];
surnames.forEach((s, i) => add(s, ABC[i % ABC.length]));

// Addresses: neutral sample addresses.
for (const [from, to] of [
  ['1209 Orange Street', '1 Main Street'], ['Wilmington', 'Sample City'], ['DE 19801', 'ST 00000'],
  ['Prestige Central', 'Sample Tower'], ['Prestige Estates Ltd', 'Sample Estates Ltd'], ['Prestige', 'Sample'],
  ['Infantry Road', 'Main Road'], ['Shivajinagar', 'Central'], ['WeWork', 'Shared office'], ['560001', '000000'],
]) add(from, to);

// Identifiers: replaced with obviously-sample shapes.
const ids = [
  ['[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}', 'U00000XX0000PTC000000'], // CIN
  ['[A-Z]{5}[0-9]{4}[A-Z]', 'ABCDE1234F'], // PAN (also inside a GSTIN)
  ['\\mAA[A-Z]-[0-9]{4}\\M', 'AAA-0000'], // LLPIN
  ['\\m[A-Z]{4}[0-9]{5}[A-Z]\\M', 'ABCD12345E'], // TAN
  ['\\m[A-Z][0-9]{7}\\M', 'A0000000'], // passport
  ['\\m([A-Z]{2,6})[0-9]{5,}[A-Z0-9]*\\M', '\\10000000'], // acknowledgement, registration and similar numbers: prefix kept
  ['\\m[A-Z]{2}[0-9]{4}\\M', 'XX0000'], // a short reference such as an SRN
  ['\\m[0-9]{12}\\M', '000000000000'], // Aadhaar-shaped
  ['\\m[6-9][0-9]{9}\\M', '9000000000'], // mobile without the country code
  ['\\+?91[ -]?[0-9]{5}[ -]?[0-9]{5}', '+91 00000 00000'], // phone
  ['\\m[0-9]{8}\\M', '00000000'], // DIN
];

const { rows: cols } = await q(`select c.table_name, c.column_name, c.data_type from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.data_type in ('text','character varying','json','jsonb')
  and c.column_name not in ('email','password_hash','id','token','token_hash','s3_key','storage_key','key')`);
let changed = 0;
for (const { table_name: t, column_name: c, data_type: dt } of cols) {
  const cast = dt === 'jsonb' || dt === 'json' ? '::text' : '';
  let expr = `"${c}"${cast}`;
  const params = [];
  for (const [re, to] of [...pairs, ...ids]) {
    params.push(re, to);
    expr = `regexp_replace(${expr}, $${params.length - 1}, $${params.length}, 'g')`;
  }
  const value = cast ? `(${expr})::${dt}` : expr;
  try {
    const r = await q(`update "${t}" set "${c}" = ${value} where "${c}" is not null and "${c}"${cast} <> ${expr}`, params);
    if (r.rowCount) {
      changed += r.rowCount;
      console.log(`${t}.${c}: ${r.rowCount}`);
    }
  } catch (e) {
    console.log(`skip ${t}.${c}: ${e.message.slice(0, 100)}`);
  }
}
console.log('rows changed', changed);
for (const [a, b] of pairs) console.log(`  ${a.replace(/\\[mM]/g, '').replace(/\\/g, '')} -> ${b}`);
await pool.end();
