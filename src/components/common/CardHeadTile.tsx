import type { CSSProperties } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CircleCheck,
  ClipboardCheck,
  Clock,
  FileText,
  IdCard,
  Inbox,
  LayoutGrid,
  List,
  Mail,
  ShieldCheck,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react';
import { CARD_HEAD_TONE_TOKENS, cardHeadIcon, type CardHeadIconName, type CardHeadTone } from '@/lib/ui/card-head-icon';

export const CARD_HEAD_ICONS: Record<CardHeadIconName, LucideIcon> = {
  'alert-triangle': TriangleAlert,
  bell: Bell,
  'circle-check': CircleCheck,
  calendar: Calendar,
  inbox: Inbox,
  file: FileText,
  'shield-check': ShieldCheck,
  'clipboard-check': ClipboardCheck,
  user: User,
  'id-card': IdCard,
  clock: Clock,
  list: List,
  'bar-chart': BarChart3,
  mail: Mail,
  'book-open': BookOpen,
  'layout-grid': LayoutGrid,
};

/**
 * The 28px tinted icon tile before every card title (K-06, rule R-16), and the
 * 30px tile before each greeting number (K-07, rule R-18). The icon
 * and tone come from the title, so the same kind of card looks the same on every
 * portal. Inline token styles keep it working inside the client portal's CSS
 * reset as well as in the staff shell.
 */
export function CardHeadTile({
  title,
  className,
  size = 28,
  icon: iconOverride,
  tone: toneOverride,
}: {
  title: string;
  className?: string;
  size?: 28 | 30;
  /** A different glyph than the title gives (prototype SectionCard `icon`). */
  icon?: LucideIcon;
  /** A different tone than the title gives. */
  tone?: CardHeadTone;
}) {
  const fromTitle = cardHeadIcon(title);
  const tone = toneOverride ?? fromTitle.tone;
  const Icon = iconOverride ?? CARD_HEAD_ICONS[fromTitle.icon];
  const t = CARD_HEAD_TONE_TOKENS[tone];
  const style: CSSProperties = {
    display: 'inline-grid',
    placeItems: 'center',
    width: size,
    height: size,
    flex: 'none',
    borderRadius: 6,
    background: `oklch(var(--${t.bg}))`,
    color: `oklch(var(--${t.fg}))`,
  };
  return (
    <span className={className} style={style} aria-hidden>
      <Icon width={15} height={15} strokeWidth={1.6} />
    </span>
  );
}
