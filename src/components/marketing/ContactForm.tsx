'use client';

import { FormEvent, useState } from 'react';
import { AccentButton } from '@/components/noir';
import { cn } from '@/lib/utils';

const CONTACT_EMAIL = 'info@vcfosuite.com';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firm, setFirm] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`VCFO Suite inquiry — ${firm || name || 'Prospect'}`);
    const body = encodeURIComponent(
      [`Name: ${name}`, `Email: ${email}`, firm ? `Firm: ${firm}` : null, '', message]
        .filter(Boolean)
        .join('\n'),
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Name" htmlFor="contact-name">
          <input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
            placeholder="Your name"
          />
        </Field>
        <Field label="Work email" htmlFor="contact-email">
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            placeholder="you@firm.com"
          />
        </Field>
      </div>
      <Field label="Firm" htmlFor="contact-firm">
        <input
          id="contact-firm"
          name="firm"
          autoComplete="organization"
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          className={fieldClass}
          placeholder="Firm name"
        />
      </Field>
      <Field label="How can we help?" htmlFor="contact-message">
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={cn(fieldClass, 'min-h-[140px] resize-y')}
          placeholder="Tell us about your GCC or compliance workflow…"
        />
      </Field>

      <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <AccentButton type="submit" size="lg" className="min-w-[10rem]">
          Open email draft
        </AccentButton>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Uses your mail app · {CONTACT_EMAIL}
        </p>
      </div>

      {sent ? (
        <p
          data-state="open"
          className="discrete-fade-up text-sm leading-relaxed text-muted-foreground"
          role="status"
        >
          If your mail app did not open, write to{' '}
          <a
            className="font-medium text-blue-700 underline-offset-4 hover:underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      ) : null}
    </form>
  );
}

const fieldClass =
  'w-full rounded-md border-0 border-b border-border bg-transparent px-0 py-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 focus-visible:border-blue-500 focus-visible:ring-0';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
