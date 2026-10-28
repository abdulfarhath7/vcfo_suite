import type { CSSProperties } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CircleCheck,
  ClipboardCheck,
  Clock,
  File,
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
import { CARD_HEAD_TONE_TOKENS, cardHeadIcon, type CardHeadIconName } from '@/lib/ui/card-head-icon';

export const CARD_HEAD_ICONS: Record<CardHeadIconName, LucideIcon> = {
  'alert-triangle': TriangleAlert,
  bell: Bell,
  'circle-check': CircleCheck,
  calendar: Calendar,
  inbox: Inbox,
  file: File,
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
export function CardHeadTile({ title, className, size = 28 }: { title: string; className?: string; size?: 28 | 30 }) {
  const { icon, tone } = cardHeadIcon(title);
  const Icon = CARD_HEAD_ICONS[icon];
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
