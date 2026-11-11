import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PartnerReportData } from './partner-report';
import { PDF_COLORS, PDF_FONTS } from '@/lib/doc-style/spectrum-pdf';

/**
 * The monthly partner report as a PDF page (G-21). Same sections, same order and the same
 * numbers as the Reports page (`buildPartnerReport`). Plain print styling, like the Ask VCFO
 * briefs in `src/lib/ask/`. Colours are the Spectrum print palette (`@/lib/doc-style/spectrum-pdf`).
 */
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: PDF_FONTS.ui, color: PDF_COLORS.ink },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18, borderBottom: `1.5pt solid ${PDF_COLORS.rule}`, paddingBottom: 10 },
  logo: { width: 96, height: 26, objectFit: 'contain', marginLeft: 'auto' },
  eyebrow: { color: PDF_COLORS.inkMuted, fontSize: 9.5 },
  title: { fontSize: 20, fontFamily: PDF_FONTS.uiBold, marginTop: 2 },
  h: { fontSize: 11.5, fontFamily: PDF_FONTS.uiBold, marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  tile: { width: '33.33%', paddingHorizontal: 3, marginBottom: 6 },
  tileBox: { border: `1pt solid ${PDF_COLORS.line}`, borderRadius: 4, padding: 8 },
  tileKey: { fontSize: 8.5, color: PDF_COLORS.ink2 },
  tileValue: { fontSize: 16, fontFamily: PDF_FONTS.uiBold, marginTop: 4 },
  ok: { color: PDF_COLORS.positive },
  warn: { color: PDF_COLORS.warning },
  bad: { color: PDF_COLORS.danger },
  muted: { color: PDF_COLORS.inkMuted },
  table: { border: `1pt solid ${PDF_COLORS.line}`, borderRadius: 4 },
  tr: { flexDirection: 'row', borderTop: `1pt solid ${PDF_COLORS.lineSoft}`, paddingVertical: 5, paddingHorizontal: 8 },
  th: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: PDF_COLORS.headFill },
  thText: { fontFamily: PDF_FONTS.uiBold, fontSize: 9 },
  cName: { flex: 1 },
  cNum: { width: 70, textAlign: 'right' },
  line: { marginBottom: 3 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: PDF_COLORS.inkMuted, textAlign: 'center' },
});

export function PartnerReportDocument({
  data,
  firmName,
  logo,
  preparedOn,
}: {
  data: PartnerReportData;
  firmName: string;
  logo: string | null;
  preparedOn: string;
}) {
  return (
    <Document title={`${firmName} partner report · ${data.monthLabel}`} author={firmName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>{firmName} · monthly partner report</Text>
            <Text style={s.title}>{data.monthLabel}</Text>
          </View>
          {logo ? <Image style={s.logo} src={logo} /> : null}
        </View>

        <Text style={s.h}>The month in numbers</Text>
        <View style={s.grid}>
          {data.numbers.map((n) => (
            <View key={n.k} style={s.tile}>
              <View style={s.tileBox}>
                <Text style={s.tileKey}>{n.k}</Text>
                <Text style={n.tone ? [s.tileValue, s[n.tone]] : s.tileValue}>{String(n.v)}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.h}>Clients</Text>
        <Text>{data.clientLine}</Text>

        <Text style={s.h}>Managers</Text>
        {data.managers.length === 0 ? (
          <Text style={s.muted}>No manager yet</Text>
        ) : (
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.thText, s.cName]}>Manager</Text>
              <Text style={[s.thText, s.cNum]}>Clients</Text>
              <Text style={[s.thText, s.cNum]}>On time</Text>
              <Text style={[s.thText, s.cNum]}>Overdue</Text>
              <Text style={[s.thText, s.cNum]}>Days to COI</Text>
            </View>
            {data.managers.map((m, i) => (
              <View key={`${m.name}-${i}`} style={s.tr} wrap={false}>
                <Text style={s.cName}>{m.name}</Text>
                <Text style={s.cNum}>{m.clients}</Text>
                <Text style={s.cNum}>{m.onTime}</Text>
                <Text style={m.overdue > 0 ? [s.cNum, s.bad] : s.cNum}>{m.overdue}</Text>
                <Text style={s.cNum}>{m.daysToCoi}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h}>Top risks</Text>
        {data.risks.length === 0 ? (
          <Text style={s.muted}>None</Text>
        ) : (
          data.risks.map((r, i) => (
            <Text key={r.id} style={s.line}>
              {i + 1}. {r.title} · {r.companyName}
            </Text>
          ))
        )}

        <Text style={s.footer} fixed>
          Prepared by VCFO Suite from the firm&apos;s records on {preparedOn}.
        </Text>
      </Page>
    </Document>
  );
}
