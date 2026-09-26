/**
 * Country and Indian state/UT pick lists for the incorporation answers that
 * the documents print verbatim (parent entity country, director nationality,
 * registered office state). Option values are the printed names, so a
 * generator never has to translate a code.
 */

export interface CountryOption {
  value: string;
  label: string;
}

/** Names that read "the …" in running legal text ("the laws of the United Kingdom"). */
const TAKES_ARTICLE = new Set([
  'Bahamas',
  'Central African Republic',
  'Comoros',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Dominican Republic',
  'Gambia',
  'Maldives',
  'Marshall Islands',
  'Netherlands',
  'Philippines',
  'Republic of the Congo',
  'Solomon Islands',
  'United Arab Emirates',
  'United Kingdom',
  'United States of America',
]);

const COUNTRY_NAMES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
  'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
  'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Democratic Republic of the Congo',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador',
  'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea',
  'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan',
  'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi',
  'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
  'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
  'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Republic of the Congo', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania',
  'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States of America', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
] as const;

export const COUNTRY_OPTIONS: readonly CountryOption[] = COUNTRY_NAMES.map((name) => ({
  value: name,
  label: name,
}));

/** "the United Kingdom", "Singapore" — for "the laws of …". */
export function countryWithArticle(country: string): string {
  const name = country.trim();
  return TAKES_ARTICLE.has(name) ? `the ${name}` : name;
}

/** The 28 states and 8 union territories, as MCA lists them. */
const INDIAN_STATE_NAMES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

export const INDIAN_STATE_OPTIONS: readonly CountryOption[] = INDIAN_STATE_NAMES.map((name) => ({
  value: name,
  label: name,
}));

/** Common spellings that differ from the MCA name. */
const INDIAN_STATE_ALIASES: Record<string, string> = {
  'new delhi': 'Delhi',
  'nct of delhi': 'Delhi',
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  uttaranchal: 'Uttarakhand',
  'j&k': 'Jammu and Kashmir',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The one state/UT an address names, for a pre-fill the user then confirms.
 * Two different names (or none) → '' — never a guess.
 */
export function inferIndianState(address: string | null | undefined): string {
  const text = (address ?? '').toLowerCase();
  if (!text.trim()) return '';
  const found = new Set<string>();
  // Longest first, so "Andhra Pradesh" is not also read as a bare "Pradesh" match elsewhere.
  const candidates = [
    ...INDIAN_STATE_NAMES.map((name) => [name.toLowerCase(), name] as const),
    ...Object.entries(INDIAN_STATE_ALIASES),
  ].sort((a, b) => b[0].length - a[0].length);
  let rest = text;
  for (const [needle, name] of candidates) {
    const re = new RegExp(`(^|[^a-z])${escapeRe(needle)}([^a-z]|$)`);
    if (re.test(rest)) {
      found.add(name);
      rest = rest.replace(re, '$1 $2');
    }
  }
  return found.size === 1 ? [...found][0]! : '';
}
