'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * "Book a demo" (G-30). Posts to `/api/public/demo-request`, which stores the request in
 * `demo_requests` (it shows on the super admin Growth screen) and emails the firm. The
 * `website` field is a honeypot: hidden from people, filled by bots.
 */
const DEMO_REQUEST_URL = '/api/public/demo-request';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firm, setFirm] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const res = await fetch(DEMO_REQUEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company: firm, message, website }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not send the request. Try again.');
      }
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request. Try again.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div data-state="open" className="discrete-fade-up space-y-3" role="status">
        <p className="font-serif text-2xl font-medium text-ink">Request sent.</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          The SBC team will write to <span className="font-medium text-ink">{email}</span> to set a time for the demo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
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
        <Button type="submit" size="lg" className="min-w-[10rem]" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending' : 'Book a demo'}
        </Button>
      </div>

      {error ? (
        <p className="text-sm leading-relaxed text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

const fieldClass =
  'w-full rounded-none border-0 border-b border-line-strong bg-transparent px-0 py-3 text-sm text-ink outline-none transition-[border-color] duration-150 placeholder:text-ink-faint focus-visible:border-brand focus-visible:ring-0';

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
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
