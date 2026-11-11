import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AnswerEnvelope, Visual } from '@/data/ask/schema';
import { visualText } from '@/lib/ask/visual-text';
import { BRIEF_DISCLAIMER, type BriefItem } from './pdf-brief-types';
import { PDF_COLORS, PDF_FONTS } from '@/lib/doc-style/spectrum-pdf';

/** The branded brief document (F3). Spectrum print palette (`@/lib/doc-style/spectrum-pdf`); no screen-only effects reach a PDF. */
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: PDF_FONTS.ui, color: PDF_COLORS.ink },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, borderBottom: `1.5pt solid ${PDF_COLORS.rule}`, paddingBottom: 10 },
  logo: { width: 110, height: 28, objectFit: 'contain' },
  headerText: { marginLeft: 'auto', textAlign: 'right' },
  company: { fontSize: 12, fontFamily: PDF_FONTS.uiBold },
  muted: { color: PDF_COLORS.inkMuted },
  item: { marginBottom: 18 },
  h: { fontSize: 14, fontFamily: PDF_FONTS.uiBold, marginBottom: 4 },
  badge: { fontSize: 8.5, color: PDF_COLORS.positive, marginBottom: 6 },
  line: { fontSize: 11, lineHeight: 1.45, marginBottom: 8 },
  label: { fontFamily: PDF_FONTS.uiBold, marginBottom: 2 },
  flowRow: { flexDirection: 'row', marginBottom: 8 },
  stage: { flexGrow: 1, flexBasis: 0, border: `1pt solid ${PDF_COLORS.line}`, borderRadius: 4, padding: 6, marginRight: 4 },
  stageHere: { borderColor: PDF_COLORS.brand, backgroundColor: PDF_COLORS.brandSoft },
  row: { flexDirection: 'row', marginBottom: 2 },
  key: { width: 130, color: PDF_COLORS.inkMuted },
  bullet: { marginBottom: 2 },
  sources: { fontSize: 8.5, color: PDF_COLORS.inkMuted, marginTop: 4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: PDF_COLORS.inkMuted, textAlign: 'center' },
});

function badgeText(answer: AnswerEnvelope, firmName: string): string {
  if (answer.draft) return 'Not yet reviewed · check with your lead';
  if (answer.origin === 'reviewed' || answer.origin === 'deterministic') return `Reviewed by ${firmName}`;
  return 'AI answer · check with your lead';
}

function VisualBlock({ visual }: { visual: Visual }) {
  switch (visual.type) {
    case 'flow':
      return (
        <View style={s.flowRow}>
          {visual.stages.map((stage, i) => (
            <View key={i} style={stage.state === 'here' ? [s.stage, s.stageHere] : s.stage}>
              <Text style={s.muted}>{stage.state === 'done' ? 'Done' : stage.state === 'here' ? 'You are here' : 'Next'}</Text>
              <Text style={s.label}>{stage.label}</Text>
              {stage.sub ? <Text style={s.muted}>{stage.sub}</Text> : null}
            </View>
          ))}
        </View>
      );
    case 'keyFacts':
    case 'metrics':
    case 'bars': {
      const rows = visual.type === 'keyFacts' ? visual.facts : visual.items.map((item) => ({ k: item.k, v: String(item.v) }));
      return (
        <View style={{ marginBottom: 8 }}>
          {rows.map((r) => (
            <View key={r.k} style={s.row}>
              <Text style={s.key}>{r.k}</Text>
              <Text style={{ flex: 1 }}>{r.v}</Text>
            </View>
          ))}
        </View>
      );
    }
    case 'steps':
      return (
        <View style={{ marginBottom: 8 }}>
          {visual.items.map((item, i) => (
            <Text key={i} style={s.bullet}>
              {i + 1}. {item.label}
              {item.form ? ` (${item.form})` : ''}
            </Text>
          ))}
        </View>
      );
    default:
      return <Text style={{ marginBottom: 8 }}>{visualText(visual)}</Text>;
  }
}

export function Brief({
  items,
  companyName,
  firmName,
  logo,
  date,
}: {
  items: BriefItem[];
  companyName: string;
  firmName: string;
  /** PNG as a data URI — react-pdf reads a bare Buffer as a file path. */
  logo: string | null;
  date: string;
}) {
  return (
    <Document title={`${companyName} — brief`} author={firmName}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          {logo ? <Image style={s.logo} src={logo} /> : <Text style={s.company}>{firmName}</Text>}
          <View style={s.headerText}>
            <Text style={s.company}>{companyName}</Text>
            <Text style={s.muted}>{date}</Text>
          </View>
        </View>
        {items.map((item, i) => (
          <View key={i} style={s.item} wrap={false}>
            <Text style={s.h}>{item.title}</Text>
            <Text style={s.badge}>{badgeText(item.answer, firmName)}</Text>
            <Text style={s.line}>{item.answer.line}</Text>
            {item.answer.visual ? <VisualBlock visual={item.answer.visual} /> : null}
            {item.answer.why ? (
              <View style={{ marginBottom: 4 }}>
                <Text style={s.label}>Why it matters to you</Text>
                <Text>{item.answer.why}</Text>
              </View>
            ) : null}
            {item.answer.citations.length > 0 ? (
              <Text style={s.sources}>Sources: {item.answer.citations.map((c) => c.label).join(' · ')}</Text>
            ) : null}
          </View>
        ))}
        <Text style={s.footer} fixed>
          {BRIEF_DISCLAIMER}
        </Text>
      </Page>
    </Document>
  );
}

