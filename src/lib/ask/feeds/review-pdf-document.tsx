import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

/**
 * The review document a manager reads before approving an official update
 * (owner, 2026-10-23). One page of facts the tool found, a reading-quality
 * check, and the opening of the original text, so the manager can judge both
 * "is this really new?" and "did the tool read it correctly?".
 */
export interface ReviewPdfInput {
  firmName: string;
  logo: string | null;
  generatedOn: string;
  sourceLabel: string;
  act: string;
  title: string;
  number: string | null;
  kind: string;
  publishedAt: string | null;
  sourceUrl: string | null;
  summary: string | null;
  amends: string[];
  effectiveFrom: string | null;
  reading: { characters: number; pieces: number; words: number; warning: string | null };
  excerpt: string;
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: 'Helvetica', color: '#1f2433' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, borderBottom: '1pt solid #d9dde6', paddingBottom: 10 },
  logo: { width: 110, height: 28, objectFit: 'contain' },
  headerText: { marginLeft: 'auto', textAlign: 'right' },
  firm: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#5b6478' },
  eyebrow: { fontSize: 9, color: '#5b6478', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 12, lineHeight: 1.3 },
  h: { fontSize: 11.5, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 5 },
  row: { flexDirection: 'row', marginBottom: 3 },
  key: { width: 150, color: '#5b6478' },
  val: { flex: 1 },
  box: { border: '1pt solid #d9dde6', borderRadius: 4, padding: 10, marginTop: 4 },
  warn: { border: '1pt solid #e0a23a', backgroundColor: '#fff7e6', borderRadius: 4, padding: 10, marginTop: 4 },
  excerpt: { fontSize: 9.5, color: '#2b3245', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: '#5b6478', textAlign: 'center' },
});

export function ReviewPdfDocument({ input }: { input: ReviewPdfInput }) {
  const r = input.reading;
  return (
    <Document title={`Review — ${input.title}`} author={input.firmName}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          {input.logo ? <Image style={s.logo} src={input.logo} /> : <Text style={s.firm}>{input.firmName}</Text>}
          <View style={s.headerText}>
            <Text style={s.firm}>Regulatory update — for review</Text>
            <Text style={s.muted}>Generated {input.generatedOn}</Text>
          </View>
        </View>

        <Text style={s.eyebrow}>
          {input.act} · {input.kind}
        </Text>
        <Text style={s.title}>{input.title}</Text>

        <Text style={s.h}>Facts the tool found</Text>
        <View style={s.row}>
          <Text style={s.key}>Number</Text>
          <Text style={s.val}>{input.number ?? 'not stated'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.key}>Published on</Text>
          <Text style={s.val}>{input.publishedAt ?? 'not stated'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.key}>Source</Text>
          <Text style={s.val}>{input.sourceLabel}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.key}>Original</Text>
          <Text style={s.val}>{input.sourceUrl ?? 'no link'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.key}>Effective from (as read)</Text>
          <Text style={s.val}>{input.effectiveFrom ?? 'not found in the text'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.key}>Amends</Text>
          <Text style={s.val}>{input.amends.length ? input.amends.join('; ') : 'no earlier notification named in the text'}</Text>
        </View>

        <Text style={s.h}>What changed (written by the tool, please verify)</Text>
        <View style={s.box}>
          <Text>{input.summary ?? 'No summary could be written.'}</Text>
        </View>

        <Text style={s.h}>Reading check</Text>
        <View style={r.warning ? s.warn : s.box}>
          <Text>
            {r.words.toLocaleString('en-IN')} words read in {r.pieces} piece{r.pieces === 1 ? '' : 's'} ({r.characters.toLocaleString('en-IN')} characters).
          </Text>
          {r.warning ? <Text style={{ marginTop: 4 }}>Warning: {r.warning}</Text> : <Text style={{ marginTop: 4 }}>The document was read in full and looks complete.</Text>}
        </View>

        <Text style={s.h}>Opening of the original text</Text>
        <View style={s.box}>
          <Text style={s.excerpt}>{input.excerpt}</Text>
        </View>

        <Text style={s.h}>What your approval does</Text>
        <Text>
          Approve: Ask VCFO answers from this update for staff and clients, and it is posted on the Announcements board with a client notice.
          Reject: it stays hidden; your reason is kept so the fetching can be corrected.
        </Text>

        <Text style={s.footer} fixed>
          {input.firmName} · prepared automatically by VCFO Suite · verify against the original before approving
        </Text>
      </Page>
    </Document>
  );
}
