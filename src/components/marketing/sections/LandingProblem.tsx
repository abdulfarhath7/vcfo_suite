'use client';

import { Reveal, RevealItem } from '@/components/marketing/Reveal';
import { Eyebrow } from '@/components/noir';

export function LandingProblem() {
  return (
    <section className="relative border-t border-border/40 bg-background py-16 sm:py-18 lg:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <Reveal className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16" stagger>
          <RevealItem>
            <Eyebrow>Why it exists</Eyebrow>
            <div className="mt-4 h-px w-12 bg-gradient-to-r from-blue-500 to-transparent" />
            <h2 className="mt-5 font-serif text-[clamp(1.95rem,4vw,3rem)] font-medium leading-[1.06] tracking-[-0.02em] text-foreground">
              Compliance is still too fragmented for modern firms.
            </h2>
          </RevealItem>

          <RevealItem>
            <p className="max-w-md text-[15px] leading-[1.75] text-muted-foreground sm:text-base lg:pb-1">
              Teams juggle documents, email, and partner handoffs while clients wait for the next update.
              The result is duplicate work, blurred deadlines, and a weaker client experience.
            </p>
          </RevealItem>
        </Reveal>

        <Reveal
          className="mt-12 grid gap-6 border-t border-border/50 pt-10 sm:grid-cols-3 sm:gap-8 sm:pt-12"
          stagger
        >
          {[
            {
              n: '01',
              title: 'Disconnected intake',
              body: 'Founders submit data in one place and teams still chase attachments in another.',
            },
            {
              n: '02',
              title: 'Manual status updates',
              body: 'Leads copy progress into sheets while managers ask for the same information again.',
            },
            {
              n: '03',
              title: 'Client uncertainty',
              body: 'Clients are left guessing next steps instead of feeling aligned to the engagement.',
            },
          ].map((item) => (
            <RevealItem key={item.n}>
              <p className="font-mono text-[11px] tracking-[0.16em] text-blue-700/75">{item.n}</p>
              <h3 className="mt-3 font-serif text-xl font-medium tracking-tight text-foreground sm:text-[1.35rem]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
