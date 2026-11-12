import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BRIEF_DISCLAIMER } from './pdf-brief-types';
import type { StatusBrief } from './status-brief';
import { PDF_COLORS, PDF_FONTS } from '@/lib/doc-style/spectrum-pdf';

/** C4 monthly status brief document. Plain print styling. */
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: PDF_FONTS.ui, color: PDF_COLORS.ink },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, borderBottom: `1.5pt solid ${PDF_COLORS.rule}`, paddingBottom: 10 },
  logo: { width: 110, height: 28, objectFit: 'contain' },
  headerText: { marginLeft: 'auto', textAlign: 'right' },
  company: { fontSize: 12, fontFamily: PDF_FONTS.uiBold },
  muted: { color: PDF_COLORS.inkMuted },
  title: { fontSize: 16, fontFamily: PDF_FONTS.uiBold, marginBottom: 12 },
  h: { fontSize: 11.5, fontFamily: PDF_FONTS.uiBold, marginTop: 12, marginBottom: 5 },
  row: { flexDirection: 'row', marginBottom: 3 },
  key: { width: 170 },
  barTrack: { flex: 1, height: 6, backgroundColor: PDF_COLORS.track, borderRadius: 3, marginTop: 3 },
  bar: { height: 6, backgroundColor: PDF_COLORS.positiveMid, borderRadius: 3 },
  count: { width: 44, textAlign: 'right', color: PDF_COLORS.inkMuted },
  line: { marginBottom: 3 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: PDF_COLORS.inkMuted, textAlign: 'center' },
});

export function StatusBriefDocument({
  brief,
  firmName,
  logo,
  date,
}: {
  brief: StatusBrief;
  firmName: string;
  logo: string | null;
  date: string;
}) {
  return (
    <Document title={`${brief.companyName} — status ${brief.monthLabel}`} author={firmName}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          {logo ? <Image style={s.logo} src={logo} /> : <Text style={s.company}>{firmName}</Text>}
          <View style={s.headerText}>
            <Text style={s.company}>{brief.companyName}</Text>
            <Text style={s.muted}>{date}</Text>
          </View>
        </View>
        <Text style={s.title}>Status brief · {brief.monthLabel}</Text>

        <Text style={s.h}>Progress by phase</Text>
        {brief.phases.map((p) => (
          <View key={p.label} style={s.row}>
            <Text style={s.key}>{p.label}</Text>
            <View style={s.barTrack}>
              <View style={[s.bar, { width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }]} />
            </View>
            <Text style={s.count}>
              {p.done}/{p.total}
            </Text>
          </View>
        ))}

        <Text style={s.h}>Done this month</Text>
        {brief.doneThisMonth.length === 0 ? (
          <Text style={s.muted}>No steps were completed this month.</Text>
        ) : (
          brief.doneThisMonth.map((t) => (
            <Text key={t} style={s.line}>
              • {t}
            </Text>
          ))
        )}

        <Text style={s.h}>What is next</Text>
        <Text>{brief.next ? `${brief.next.title} — with ${brief.next.withWhom}.` : 'Every checklist step is complete.'}</Text>

        <Text style={s.h}>Upcoming compliances</Text>
        {brief.upcoming.length === 0 ? (
          <Text style={s.muted}>Nothing is due in the next 30 days.</Text>
        ) : (
          brief.upcoming.map((u) => (
            <View key={`${u.name}-${u.dueDate}`} style={s.row}>
              <Text style={s.key}>{u.name}</Text>
              <Text>{u.dueDate}</Text>
            </View>
          ))
        )}

        <Text style={s.footer} fixed>
          {BRIEF_DISCLAIMER}
        </Text>
      </Page>
    </Document>
  );
}
