
const EMAIL_OPTIONAL = ['announcements', 'feed', 'weeklyDigest'] as const;
const WHATSAPP_CATEGORIES = ['docs', 'steps', 'deadlines', 'timeline', 'announcements', 'feed'] as const;

export type EmailOptional = (typeof EMAIL_OPTIONAL)[number];
export type WhatsAppCategory = (typeof WHATSAPP_CATEGORIES)[number];

export interface NotificationPrefs {
  email: Record<EmailOptional, boolean>;
  whatsapp: Record<WhatsAppCategory, boolean>;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
}

export interface NotificationPrefsPatch {
  email?: Partial<Record<EmailOptional, boolean>>;
  whatsapp?: Partial<Record<WhatsAppCategory, boolean>>;
  quietHours?: boolean;
}

/** The board's defaults (settings_redesign: em {ann:on, feed:off, digest:on}, wa on except news). */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: { announcements: true, feed: false, weeklyDigest: true },
  whatsapp: { docs: true, steps: true, deadlines: true, timeline: true, announcements: false, feed: false },
  quietHours: true,
  quietStart: '21:00',
  quietEnd: '08:00',
};

export function normalizeNotificationPrefsPatch(input: unknown): NotificationPrefsPatch {
  const out: NotificationPrefsPatch = {};
  if (!input || typeof input !== 'object') return out;
  const p = input as Record<string, unknown>;
  if (p.email && typeof p.email === 'object') {
    const e: Partial<Record<EmailOptional, boolean>> = {};
    for (const k of EMAIL_OPTIONAL) {
      const v = (p.email as Record<string, unknown>)[k];
      if (typeof v === 'boolean') e[k] = v;
    }
    out.email = e;
  }
  if (p.whatsapp && typeof p.whatsapp === 'object') {
    const w: Partial<Record<WhatsAppCategory, boolean>> = {};
    for (const k of WHATSAPP_CATEGORIES) {
      const v = (p.whatsapp as Record<string, unknown>)[k];
      if (typeof v === 'boolean') w[k] = v;
    }
    out.whatsapp = w;
  }
  if (typeof p.quietHours === 'boolean') out.quietHours = p.quietHours;
  return out;
}
