'use client';

import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { Mail, MessagesSquare, Phone } from 'lucide-react';
import type { ClientOverviewTeamMember } from '@/lib/client-overview';
import { initialsFromName } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** Fallback when no PM/lead email is on file. Same address as `/contact`. */
const FIRM_EMAIL = 'info@vcfosuite.com';
/** Optional firm support line (E.164). WhatsApp falls back to it when a person has no number. */
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE_E164?.trim() || null;

type Ink = 'light' | 'dark';

interface Contact {
  kind: 'whatsapp' | 'call' | 'email' | 'teams';
  href: string;
}

function WhatsAppGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.41 9.41 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.67-1.49a11.3 11.3 0 0 0 5.78 1.47h.01c6.26 0 11.35-5.09 11.35-11.34 0-3.03-1.18-5.88-3.32-8.02z" />
    </svg>
  );
}

const CONTACT_META: Record<
  Contact['kind'],
  { label: string; icon: ComponentType<{ className?: string }>; brand: string }
> = {
  whatsapp: { label: 'WhatsApp', icon: WhatsAppGlyph, brand: '#25D366' },
  call: { label: 'Call', icon: Phone, brand: 'oklch(var(--success))' },
  email: { label: 'Email', icon: Mail, brand: 'oklch(var(--primary))' },
  teams: { label: 'Teams', icon: MessagesSquare, brand: '#5B5FC7' },
};

function digits(phoneE164: string): string {
  return phoneE164.replace(/[^\d]/g, '');
}

function mailHref(email: string, companyName: string, firstName: string): string {
  const subject = encodeURIComponent(`${companyName} — question for the VCFO team`);
  const body = encodeURIComponent(`Hi ${firstName},\n\n\n\n— sent from the ${companyName} client portal`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/**
 * WhatsApp is always offered. It opens a chat with the person's own number,
 * else the firm support line addressed to them, else WhatsApp's own contact
 * picker with the message ready to send.
 */
function whatsappHref(name: string, phone: string | null | undefined, companyName: string): string {
  const firstName = name.split(' ')[0] || 'team';
  if (phone) {
    return `https://wa.me/${digits(phone)}?text=${encodeURIComponent(`Hi ${firstName}, this is ${companyName}. `)}`;
  }
  const message = `Hi, this is ${companyName}. A question for ${name} at VCFO: `;
  if (SUPPORT_PHONE) return `https://wa.me/${digits(SUPPORT_PHONE)}?text=${encodeURIComponent(message)}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Every way to reach one person; Call only when they saved a number. */
export function contactsFor(
  person: { name: string; email?: string; phoneE164?: string | null },
  companyName: string,
): Contact[] {
  const phone = person.phoneE164?.trim();
  const out: Contact[] = [{ kind: 'whatsapp', href: whatsappHref(person.name, phone, companyName) }];
  if (phone) out.push({ kind: 'call', href: `tel:+${digits(phone)}` });
  if (person.email) {
    out.push({ kind: 'email', href: mailHref(person.email, companyName, person.name.split(' ')[0] || 'team') });
    out.push({ kind: 'teams', href: `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(person.email)}` });
  }
  return out;
}

function ContactButtons({ who, contacts, ink }: { who: string; contacts: Contact[]; ink: Ink }) {
  const light = ink === 'light';
  return (
    <span className="flex shrink-0 items-center gap-1">
      {contacts.map((contact) => {
        const meta = CONTACT_META[contact.kind];
        const external = contact.kind === 'whatsapp' || contact.kind === 'teams';
        return (
          <a
            key={contact.kind}
            href={contact.href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
            aria-label={`${meta.label} ${who}`}
            title={`${meta.label} ${who}`}
            style={{ '--brand': meta.brand } as CSSProperties}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-lg transition-all duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              light
                ? 'bg-[color:var(--brand)] text-white shadow-[0_4px_10px_-4px_var(--brand)] hover:brightness-110'
                : 'bg-[color:color-mix(in_srgb,var(--brand)_14%,transparent)] text-[color:var(--brand)] ring-1 ring-[color:color-mix(in_srgb,var(--brand)_28%,transparent)] hover:bg-[color:var(--brand)] hover:text-white hover:shadow-[0_4px_10px_-4px_var(--brand)]',
            )}
          >
            <meta.icon className="h-3.5 w-3.5" aria-hidden />
          </a>
        );
      })}
    </span>
  );
}

/** The client's firm-side people, always in view in the sidebar, each one a tap away. */
export function ClientTeamCard({
  team,
  companyName,
  ink = 'dark',
}: {
  team: ClientOverviewTeamMember[];
  companyName: string;
  ink?: Ink;
}) {
  const light = ink === 'light';
  const support = contactsFor({ name: 'VCFO support', email: FIRM_EMAIL, phoneE164: SUPPORT_PHONE }, companyName).filter(
    (contact) => contact.kind !== 'teams',
  );

  return (
    <section
      aria-label="Your team"
      className={cn(
        'mx-1 mb-2 rounded-xl border p-2.5',
        light ? 'border-white/20 bg-white/10' : 'border-border/60 bg-muted/30',
      )}
    >
      <h2
        className={cn(
          'px-0.5 font-mono text-[9px] uppercase tracking-[0.14em]',
          light ? 'text-white/90' : 'text-muted-foreground',
        )}
      >
        Your team
      </h2>

      {team.length === 0 ? (
        <p className={cn('mt-2 px-0.5 text-[12px] leading-snug', light ? 'text-white/85' : 'text-muted-foreground')}>
          Being assigned. Write to{' '}
          <a
            href={`mailto:${FIRM_EMAIL}`}
            className={cn('font-medium underline-offset-2 hover:underline', light ? 'text-white' : 'text-primary')}
          >
            {FIRM_EMAIL}
          </a>
        </p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {team.map((member) => (
            <li key={member.id} className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
                    light
                      ? 'bg-white/90 text-primary'
                      : member.role === 'Project Manager'
                        ? 'bg-primary-light text-primary-dark'
                        : 'bg-[oklch(var(--phase-post-soft))] text-[oklch(var(--phase-post-text))]',
                  )}
                  aria-hidden
                >
                  {initialsFromName(member.name)}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-[12.5px] font-semibold leading-tight',
                      light ? 'text-white' : 'text-foreground',
                    )}
                  >
                    {member.name}
                  </span>
                  <span
                    className={cn('block truncate text-[11px] leading-tight', light ? 'text-white/75' : 'text-muted-foreground')}
                  >
                    {member.role}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 pl-9">
                <ContactButtons who={member.name} contacts={contactsFor(member, companyName)} ink={ink} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          'mt-2.5 flex items-center gap-2 border-t pt-2',
          light ? 'border-white/15' : 'border-border/60',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate text-[11.5px] font-medium', light ? 'text-white/85' : 'text-muted-foreground')}>
          VCFO support
        </span>
        <ContactButtons who="support" contacts={support} ink={ink} />
      </div>
    </section>
  );
}
