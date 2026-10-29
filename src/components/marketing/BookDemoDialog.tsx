'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDemoRequest } from './use-demo-request';

/**
 * "Book a demo" as the prototype's small modal (VCFO Spectrum, BookDemoDialog): a 420 px card on
 * the scrim with a 52 px head, three required fields (Name, Firm, Work email) and "Send" in the
 * footer. Unlike the prototype it really sends: it posts to `/api/public/demo-request` through
 * `useDemoRequest`, shows the route's error in a red line, and after a send shows "Request sent
 * to SBC" with Close. On a phone it rises from the bottom edge.
 */
export function BookDemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, error, send, reset } = useDemoRequest();
  const [name, setName] = useState('');
  const [firm, setFirm] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [sentTo, setSentTo] = useState('');

  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next && state === 'sent') {
      reset();
      setName('');
      setFirm('');
      setEmail('');
      setSentTo('');
    }
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await send({ name, email, company: firm, website });
    if (ok) setSentTo(email.trim());
  }

  const sent = state === 'sent';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={change}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[92vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-md border border-line bg-surface-raised text-ink shadow-dialog outline-none',
            'max-sm:max-w-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md',
          )}
        >
          <header className="flex min-h-head items-start gap-3 border-b border-line-soft px-4 py-3 md:px-5">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[15px] font-medium leading-snug">Book a demo</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="grid h-8 w-8 flex-none place-items-center rounded-md text-ink-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.6} />
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
            {sent ? (
              <p className="text-[14px] text-ink-2" role="status">
                Request sent to SBC. The reply goes to {sentTo}.
              </p>
            ) : (
              <form id="book-demo-form" onSubmit={onSubmit} className="grid gap-3.5">
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="book-demo-website">Website</label>
                  <input
                    id="book-demo-website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <DemoField label="Name" htmlFor="book-demo-name">
                  <Input id="book-demo-name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </DemoField>
                <DemoField label="Firm" htmlFor="book-demo-firm">
                  <Input id="book-demo-firm" name="firm" autoComplete="organization" required value={firm} onChange={(e) => setFirm(e.target.value)} />
                </DemoField>
                <DemoField label="Work email" htmlFor="book-demo-email">
                  <Input id="book-demo-email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </DemoField>
                {error ? (
                  <p className="text-[13px] text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
              </form>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-4 py-3 md:px-5">
            {sent ? (
              <Button onClick={() => change(false)}>Close</Button>
            ) : (
              <Button type="submit" form="book-demo-form" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending' : 'Send'}
              </Button>
            )}
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** R-47 field: the 13 px label above a 40 px input. Shared by the dialog and the /contact form. */
export function DemoField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
    </div>
  );
}
