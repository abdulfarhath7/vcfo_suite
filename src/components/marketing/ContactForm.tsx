'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DemoField } from './BookDemoDialog';
import { useDemoRequest } from './use-demo-request';

/**
 * "Book a demo" on the /contact page (G-30). It posts the same request as the Book a demo
 * dialog through `useDemoRequest`, with one more field, "How can we help?". The fields are the
 * R-47 inputs (40 px, 1.5 px edge, 6 px corners, label above). The `website` field is a
 * honeypot: hidden from people, filled by bots.
 */
export function ContactForm() {
  const { state, error, send } = useDemoRequest();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firm, setFirm] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await send({ name, email, company: firm, message, website });
  }

  if (state === 'sent') {
    return (
      <div data-state="open" className="discrete-fade-up space-y-2" role="status">
        <p className="text-[15px] font-medium text-ink">Request sent to SBC.</p>
        <p className="text-[14px] leading-relaxed text-ink-2">The reply goes to {email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
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
      <div className="grid gap-4 sm:grid-cols-2">
        <DemoField label="Name" htmlFor="contact-name">
          <Input id="contact-name" name="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </DemoField>
        <DemoField label="Work email" htmlFor="contact-email">
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </DemoField>
      </div>
      <DemoField label="Firm" htmlFor="contact-firm">
        <Input id="contact-firm" name="firm" required autoComplete="organization" value={firm} onChange={(e) => setFirm(e.target.value)} />
      </DemoField>
      <DemoField label="How can we help?" htmlFor="contact-message">
        <Textarea
          id="contact-message"
          name="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[120px] resize-y"
        />
      </DemoField>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending' : 'Send'}
        </Button>
      </div>
    </form>
  );
}
