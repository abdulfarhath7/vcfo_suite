'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Cloth = 'ink' | 'statute' | 'tax';

type ReferenceBook = {
  id: string;
  title: string;
  authority: string;
  author: string;
  published: string;
  overview: string;
  cloth: Cloth;
};

/**
 * Standing reference titles for the client library. The covers are set in
 * type, not photography. The PDF for each title is added later; the reader
 * opens now and says so.
 */
const BOOKS: ReferenceBook[] = [
  {
    id: 'companies-act',
    title: 'Companies Act, 2013',
    authority: 'MCA',
    author: 'Ministry of Corporate Affairs',
    published: 'As amended',
    overview: 'The statute that governs incorporation, directors, share capital, and the filings that follow the Certificate of Incorporation.',
    cloth: 'ink',
  },
  {
    id: 'fema',
    title: 'Foreign Exchange Management',
    authority: 'RBI',
    author: 'Reserve Bank of India',
    published: 'As amended',
    overview: 'The rules a foreign parent meets when capital comes into an Indian company, including FC-GPR and the annual return.',
    cloth: 'statute',
  },
  {
    id: 'gst',
    title: 'Goods and Services Tax',
    authority: 'CBIC',
    author: 'Central Board of Indirect Taxes',
    published: 'As amended',
    overview: 'Registration, returns, and the invoices an Indian company keeps once GST is live.',
    cloth: 'tax',
  },
  {
    id: 'income-tax',
    title: 'Income-tax Act',
    authority: 'CBDT',
    author: 'Central Board of Direct Taxes',
    published: 'As amended',
    overview: 'Tax deduction, advance tax, and the returns that sit on the compliance calendar after incorporation.',
    cloth: 'statute',
  },
  {
    id: 'spice',
    title: 'SPICe+ filing notes',
    authority: 'MCA',
    author: 'VCFO Suite',
    published: 'Working note',
    overview: 'How Part A and Part B of SPICe+ are prepared, and which step belongs to the client.',
    cloth: 'ink',
  },
];

const CLOTH: Record<Cloth, string> = {
  ink: 'bg-foreground text-background',
  statute: 'bg-primary text-primary-foreground',
  tax: 'bg-success text-success-foreground',
};

export function ReferenceShelf() {
  const [open, setOpen] = useState<ReferenceBook | null>(null);

  return (
    <section className="border border-border bg-panel">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-serif text-[18px] font-semibold text-foreground">Reference</h2>
        <p className="text-[12px] font-medium text-muted-foreground">{BOOKS.length} titles</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
        {BOOKS.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              onClick={() => setOpen(book)}
              className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span
                className={cn(
                  'flex h-44 flex-col justify-between p-3 transition-transform duration-200 group-hover:-translate-y-0.5',
                  CLOTH[book.cloth],
                )}
              >
                <span className="font-serif text-[15px] font-semibold leading-snug">{book.title}</span>
                <span className="text-[10px] font-semibold tracking-[0.14em]">{book.authority}</span>
              </span>
              <span className="mt-2 block text-[13px] font-semibold leading-snug text-foreground">{book.title}</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">{book.author}</span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-md">
          {open ? (
            <div className="grid sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className={cn('flex min-h-64 flex-col justify-between p-5', CLOTH[open.cloth])}>
                <p className="font-serif text-[22px] font-semibold leading-snug">{open.title}</p>
                <p className="text-[11px] font-semibold tracking-[0.14em]">{open.authority}</p>
              </div>
              <div className="px-5 py-5">
                <p className="text-[12px] font-semibold text-primary">{open.authority}</p>
                <DialogTitle className="serif mt-1 text-[22px] leading-tight">{open.title}</DialogTitle>
                <p className="mt-1 text-[13px] text-muted-foreground">{open.author}</p>
                <p className="mt-4 text-[13.5px] font-medium leading-relaxed text-foreground">{open.overview}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground">Published</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-foreground">{open.published}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground">File</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-foreground">PDF not loaded yet</dd>
                  </div>
                </dl>
                <p className="mt-5 text-[12px] font-medium text-muted-foreground">
                  Download opens once the PDF is loaded.
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
